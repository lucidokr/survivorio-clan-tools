import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  MenuItem,
  Checkbox,
  Tooltip,
  IconButton,
  Chip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { styled } from '@mui/material/styles';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

// Helper to get current ISO week in YYYY-Www format
function getCurrentWeek() {
  const now = new Date();
  // Get ISO week number
  const target = new Date(now.valueOf());
  // ISO week starts on Monday
  const dayNumber = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / (7 * 24 * 60 * 60 * 1000));
  const year = now.getFullYear();

  // Format: YYYY-Www (required by HTML week input)
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Helper to get Monday of a given week as Date object
function getWeekMonday(weekStr) {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  // Find the first Thursday of the year
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Sunday = 7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Calculate Monday of the target week
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  monday.setHours(0, 0, 0, 0);

  return monday;
}

// Helper to get week date range (Monday to Sunday)
function getWeekDateRange(weekStr) {
  const monday = getWeekMonday(weekStr);
  if (!monday) return { start: '', end: '' };

  // Calculate Sunday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d) => d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}

// Helper to navigate weeks
function changeWeek(weekStr, delta) {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;

  let year = parseInt(match[1]);
  let weekNum = parseInt(match[2]) + delta;

  // Handle year boundaries
  if (weekNum < 1) {
    year--;
    weekNum = 52; // Simplified - most years have 52 weeks
  } else if (weekNum > 52) {
    year++;
    weekNum = 1;
  }

  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

const ResultUpload = () => {
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [week, setWeek] = useState(getCurrentWeek());
  const [members, setMembers] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [totalScoreWeek1, setTotalScoreWeek1] = useState(0);
  const [totalAvgImprovement, setTotalAvgImprovement] = useState(null);
  const [bossLevel, setBossLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'score', 'improvement'

  // Get week date range
  const weekRange = useMemo(() => getWeekDateRange(week), [week]);

  // Calculate rankings based on score
  const memberRankings = useMemo(() => {
    const withScores = members
      .map((m, originalIndex) => ({ ...m, originalIndex, numScore: parseInt(m.score) || 0 }))
      .filter(m => m.numScore > 0)
      .sort((a, b) => b.numScore - a.numScore);

    const rankings = {};
    withScores.forEach((m, rank) => {
      rankings[m._id] = rank + 1;
    });
    return rankings;
  }, [members]);

  // Sorted members for display
  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    switch (sortBy) {
      case 'score':
        sorted.sort((a, b) => (parseInt(b.score) || 0) - (parseInt(a.score) || 0));
        break;
      case 'improvement':
        sorted.sort((a, b) => (b.history?.avgImprovement || -9999) - (a.history?.avgImprovement || -9999));
        break;
      case 'name':
      default:
        sorted.sort((a, b) => (a.playerName || '').toUpperCase().localeCompare((b.playerName || '').toUpperCase()));
        break;
    }
    return sorted;
  }, [members, sortBy]);

  // Get rank tag for a member
  const getRankTag = (memberId) => {
    const rank = memberRankings[memberId];
    if (!rank) return { label: 'OUT', color: 'default' };
    if (rank <= 10) return { label: 'TOP 10', color: 'success' };
    if (rank <= 20) return { label: 'TOP 20', color: 'primary' };
    if (rank <= 30) return { label: 'TOP 30', color: 'warning' };
    return { label: 'OUT', color: 'default' };
  };

  // Auto-save feedback timer
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  useEffect(() => {
    fetchClans();
  }, []);

  const calculateTotalScore = useCallback((memberList) => {
    // Calculate total score from top 30 members
    const scores = memberList
      .map(m => Number.parseInt(m.score) || 0)
      .sort((a, b) => b - a) // Descending
      .slice(0, 30); // Top 30

    const total = scores.reduce((sum, score) => sum + score, 0);
    setTotalScore(total);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all members (includes inactive)
      const clanMembers = await api.members.getByClan(selectedClan);

      // Get Monday of the selected week for filtering deleted members
      const weekMonday = getWeekMonday(week);

      // Filter out members that were deleted before this week started
      // A member should appear if: they are active OR they were deleted after this week started
      const relevantMembers = clanMembers.filter(member => {
        if (member.isActive) return true; // Active members always show
        if (!member.deletedAt) return true; // Members without deletedAt show (legacy data)

        // Convert deletedAt to Date (Firebase timestamp or ISO string)
        const deletedDate = member.deletedAt?._seconds
          ? new Date(member.deletedAt._seconds * 1000)
          : new Date(member.deletedAt);

        // Show member if they were deleted on or after the week started
        return deletedDate >= weekMonday;
      });

      // Sort members by playerName
      relevantMembers.sort((a, b) => {
        const nameA = (a.playerName || '').toUpperCase();
        const nameB = (b.playerName || '').toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      // Fetch comparison data which includes current results and history
      const comparisonData = await api.results.compare(selectedClan, week);

      // Handle both old format (array) and new format (object with members and totals)
      const membersData = Array.isArray(comparisonData) ? comparisonData : comparisonData.members || [];
      const totalsData = comparisonData.totals || null;

      // Merge members with their results
      const mergedData = relevantMembers.map(member => {
        const stats = membersData.find(s => s.member._id === member._id);
        return {
          ...member,
          score: stats ? (stats.current || '') : '',
          missedBossDay1: stats?.missedBossDay1 || false,
          missedBossDay2: stats?.missedBossDay2 || false,
          missedBossDay3: stats?.missedBossDay3 || false,
          history: {
            week1: stats ? stats.week1 : null,
            avgImprovement: stats ? stats.avgImprovement : null
          }
        };
      });

      // Get bossLevel from response (already includes fallback to previous week)
      if (comparisonData.bossLevel) {
        setBossLevel(comparisonData.bossLevel.toString());
      } else {
        setBossLevel('');
      }

      // Set totals from backend if available
      if (totalsData) {
        setTotalScoreWeek1(totalsData.week1 || 0);
        setTotalAvgImprovement(totalsData.avgImprovement);
      }

      setMembers(mergedData);
      calculateTotalScore(mergedData);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedClan, week, calculateTotalScore]);

  useEffect(() => {
    if (selectedClan && week) {
      fetchData();
    }
  }, [selectedClan, week, fetchData]);

  const fetchClans = async () => {
    try {
      const response = await api.clan.getMyClans();
      setClans(response);
      if (response.length > 0) {
        setSelectedClan(response[0]._id);
      }
    } catch (err) {
      console.error('Error fetching clans:', err);
      setError('Failed to fetch clans');
    }
  };

  const handleScoreChange = (memberId, value) => {
    const newMembers = [...members];
    const index = newMembers.findIndex(m => m._id === memberId);
    if (index !== -1) {
      newMembers[index].score = value;
      setMembers(newMembers);
      calculateTotalScore(newMembers);
    }
  };

  const handleMissedBossChange = (memberId, day, checked) => {
    const newMembers = [...members];
    const index = newMembers.findIndex(m => m._id === memberId);
    if (index !== -1) {
      newMembers[index][`missedBossDay${day}`] = checked;
      setMembers(newMembers);
    }
  };

  const handleScreenshotUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    if (files.length > 6) {
      setError("You can only upload up to 6 screenshots at a time.");
      return;
    }

    setOcrLoading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('screenshot', file);
    });
    formData.append('clanId', selectedClan);

    try {
      const extractedResults = await api.results.extract(formData);

      // Map extracted results to members
      const newMembers = [...members];
      let matchCount = 0;

      extractedResults.forEach(extracted => {
        // Find matching member by EXACT name (since backend already normalized it)
        const index = newMembers.findIndex(m => m.playerName === extracted.playerName);
        if (index !== -1) {
          newMembers[index].score = extracted.score;
          matchCount++;
        }
      });

      // Update state with new scores
      setMembers(newMembers);
      calculateTotalScore(newMembers);
      setMessage(`OCR completed! Matched ${matchCount} of ${extractedResults.length} extracted results.`);

    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to process screenshot');
    } finally {
      setOcrLoading(false);
      // Reset input value
      event.target.value = null;
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      const resultsToSave = members
        .filter(m => (m.score !== '' && m.score !== null) || m.missedBossDay1 || m.missedBossDay2 || m.missedBossDay3)
        .map(m => ({
          memberId: m._id,
          score: m.score,
          missedBossDay1: m.missedBossDay1 || false,
          missedBossDay2: m.missedBossDay2 || false,
          missedBossDay3: m.missedBossDay3 || false
        }));

      await api.results.bulkSave({
        clanId: selectedClan,
        week: week,
        bossLevel: bossLevel ? parseInt(bossLevel) : null,
        results: resultsToSave
      });

      setMessage('Results saved successfully!');
    } catch (error) {
      setError('Failed to save results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header with Clan selector and Week navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          select
          label="Select Clan"
          value={selectedClan}
          onChange={(e) => setSelectedClan(e.target.value)}
          sx={{ width: 180 }}
          size="small"
        >
          {clans.map((clan) => (
            <MenuItem key={clan._id} value={clan._id}>
              {clan.name}
            </MenuItem>
          ))}
        </TextField>

        {/* Week Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setWeek(changeWeek(week, -1))} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center', minWidth: 200 }}>
            <TextField
              type="week"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150 }}
            />
            <Typography variant="caption" display="block" color="text.secondary">
              {weekRange.start} → {weekRange.end}
            </Typography>
          </Box>
          <IconButton onClick={() => setWeek(changeWeek(week, 1))} size="small">
            <ArrowForwardIcon />
          </IconButton>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            component="label"
            variant="outlined"
            size="small"
            startIcon={ocrLoading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
            disabled={ocrLoading || loading}
          >
            Upload OCR
            <VisuallyHiddenInput type="file" onChange={handleScreenshotUpload} accept="image/*" multiple />
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSaveAll}
            disabled={loading || ocrLoading}
          >
            Save
          </Button>
        </Box>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Bar - Boss Level and Total Score */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Boss Level</Typography>
            <TextField
              type="number"
              value={bossLevel}
              onChange={(e) => setBossLevel(e.target.value)}
              size="small"
              placeholder="Lv."
              sx={{ width: 80, ml: 1 }}
              inputProps={{ style: { textAlign: 'center' } }}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Total Score (Top 30)</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="h5" color="primary" fontWeight="bold">
                {totalScore.toLocaleString()}
              </Typography>
              {totalScore > 0 && totalScoreWeek1 > 0 && (() => {
                const diff = totalScore - totalScoreWeek1;
                const color = diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary';
                const sign = diff > 0 ? '+' : '';
                return (
                  <Typography variant="body2" sx={{ color, fontWeight: 'bold' }}>
                    ({sign}{diff.toLocaleString()} vs 1w)
                  </Typography>
                );
              })()}
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Avg Δ/week</Typography>
            <Typography variant="h6" sx={{
              color: totalAvgImprovement === null ? 'text.secondary' :
                totalAvgImprovement > 0 ? 'success.main' :
                  totalAvgImprovement < 0 ? 'error.main' : 'text.secondary',
              fontWeight: 'bold'
            }}>
              {totalAvgImprovement === null ? '-' :
                `${totalAvgImprovement > 0 ? '+' : ''}${totalAvgImprovement.toLocaleString()}`}
            </Typography>
          </Box>
        </Box>

        {/* Sort Options */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Sort by:</Typography>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={(e, val) => val && setSortBy(val)}
            size="small"
          >
            <ToggleButton value="name">
              <Tooltip title="Sort by Name">
                <SortByAlphaIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="score">
              <Tooltip title="Sort by Score">
                <LeaderboardIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="improvement">
              <Tooltip title="Sort by Avg Improvement">
                <TrendingUpIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '40px 200px 100px 70px 90px 100px', gap: 1, alignItems: 'center', mb: 1, fontWeight: 'bold', px: 1, minWidth: 650 }}>
            <Box>#</Box>
            <Box>Member</Box>
            <Box>Score</Box>
            <Box>Vs 1w</Box>
            <Box>Avg Δ/w</Box>
            <Tooltip title="Mark if member missed attacking the boss in phase 2">
              <Box sx={{ textAlign: 'center', fontSize: '0.75rem' }}>Missed Boss P2</Box>
            </Tooltip>
          </Box>
          <Box sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {sortedMembers.map((member, displayIndex) => {
              const currentScore = parseInt(member.score) || 0;
              const hasScore = member.score !== '' && member.score !== null && member.score !== undefined && currentScore > 0;
              const diff1 = (hasScore && member.history?.week1) ? currentScore - member.history.week1 : null;
              const avgImprovement = member.history?.avgImprovement;
              const rankTag = getRankTag(member._id);

              const renderDiff = (diff) => {
                if (diff === null) return '-';
                const color = diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary';
                const sign = diff > 0 ? '+' : '';
                return <Typography variant="body2" sx={{ color, fontWeight: 'bold' }}>{sign}{diff}</Typography>;
              };

              return (
                <Box key={member._id} sx={{
                  display: 'grid',
                  gridTemplateColumns: '40px 200px 100px 70px 90px 100px',
                  gap: 1,
                  alignItems: 'center',
                  bgcolor: displayIndex % 2 === 0 ? 'action.hover' : 'background.paper',
                  p: 1,
                  borderRadius: 1,
                  borderBottom: '1px solid #eee',
                  minWidth: 650,
                  opacity: member.isActive === false ? 0.6 : 1
                }}>
                  <Typography variant="body2" color="text.secondary">{displayIndex + 1}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
                    <Typography
                      variant="body2"
                      noWrap
                      title={member.playerName}
                      sx={{
                        flexShrink: 1,
                        minWidth: 0,
                        textDecoration: member.isActive === false ? 'line-through' : 'none',
                        color: member.isActive === false ? 'text.secondary' : 'inherit'
                      }}
                    >
                      {member.playerName}
                    </Typography>
                    {member.isActive === false && (
                      <Chip
                        label="Removed"
                        size="small"
                        color="default"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          flexShrink: 0,
                          '& .MuiChip-label': { px: 0.5 }
                        }}
                      />
                    )}
                    <Chip
                      label={rankTag.label}
                      size="small"
                      color={rankTag.color}
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        flexShrink: 0,
                        '& .MuiChip-label': { px: 0.5 }
                      }}
                    />
                  </Box>
                  <TextField
                    size="small"
                    type="number"
                    value={member.score}
                    onChange={(e) => handleScoreChange(member._id, e.target.value)}
                    placeholder="Score"
                    fullWidth
                  />
                  <Box>{renderDiff(diff1)}</Box>
                  <Box>{renderDiff(avgImprovement)}</Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0 }}>
                    <Tooltip title="Day 1">
                      <Checkbox
                        size="small"
                        checked={member.missedBossDay1 || false}
                        onChange={(e) => handleMissedBossChange(member._id, 1, e.target.checked)}
                        sx={{ p: 0.3 }}
                      />
                    </Tooltip>
                    <Tooltip title="Day 2">
                      <Checkbox
                        size="small"
                        checked={member.missedBossDay2 || false}
                        onChange={(e) => handleMissedBossChange(member._id, 2, e.target.checked)}
                        sx={{ p: 0.3 }}
                      />
                    </Tooltip>
                    <Tooltip title="Day 3">
                      <Checkbox
                        size="small"
                        checked={member.missedBossDay3 || false}
                        onChange={(e) => handleMissedBossChange(member._id, 3, e.target.checked)}
                        sx={{ p: 0.3 }}
                      />
                    </Tooltip>
                  </Box>
                </Box>
              );
            })}
            {members.length === 0 && (
              <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                No members found in this clan. Add members first.
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default ResultUpload;
