import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Box,
  Grid,
  CircularProgress,
  Alert,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import api from '../services/api';

const Statistics = () => {
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [communities, setCommunities] = useState([]);
  const [scope, setScope] = useState('clan'); // 'clan' or 'community'
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [weeksToShow, setWeeksToShow] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Statistics data
  const [weeklyTotals, setWeeklyTotals] = useState([]);
  const [weeklyAverages, setWeeklyAverages] = useState([]);
  const [clanGrowth, setClanGrowth] = useState([]);
  const [memberGrowth, setMemberGrowth] = useState([]);

  const weekOptions = [4, 8, 12, 16, 20, 24];

  // Persistence keys/helpers
  const STATS_KEYS = {
    scope: 'clanTools:stats_scope',
    selectedClan: 'clanTools:stats_selectedClan',
    selectedCommunity: 'clanTools:stats_selectedCommunity',
    weeksToShow: 'clanTools:stats_weeksToShow',
    activeTab: 'clanTools:stats_activeTab'
  };
  const readSaved = (key) => sessionStorage.getItem(key) || localStorage.getItem(key);
  const saveLocal = (key, value) => {
    try {
      sessionStorage.setItem(key, String(value));
      localStorage.setItem(key, String(value));
    } catch (e) {}
  };

  const getColorForString = (str) => {
    if (!str) return { color: '#e0e0e0', textColor: '#111' };
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const color = '#' + '00000'.substring(0, 6 - c.length) + c;
    const r = parseInt(color.substr(1, 2), 16) / 255;
    const g = parseInt(color.substr(3, 2), 16) / 255;
    const b = parseInt(color.substr(5, 2), 16) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const textColor = lum > 0.6 ? '#111' : '#fff';
    return { color, textColor };
  };

  useEffect(() => {
    fetchClans();
    fetchCommunities();
  }, []);

  useEffect(() => {
    if ((scope === 'clan' && selectedClan) || (scope === 'community' && selectedCommunity)) {
      fetchStatistics();
    }
  }, [selectedClan, selectedCommunity, weeksToShow, scope]);

  const fetchClans = async () => {
    try {
      const response = await api.clan.getMyClans();
      setClans(response);
      if (response.length > 0) {
        const saved = readSaved(STATS_KEYS.selectedClan);
        if (saved && response.some(c => c._id === saved)) {
          setSelectedClan(saved);
        } else {
          setSelectedClan(response[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
    }
  };

  const fetchCommunities = async () => {
    try {
      const response = await api.community.getAll();
      setCommunities(response);
      if (response.length > 0) {
        const saved = readSaved(STATS_KEYS.selectedCommunity);
        if (saved && response.some(c => c.id === saved)) {
          setSelectedCommunity(saved);
        } else if (!selectedCommunity) {
          setSelectedCommunity(response[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch communities', err);
    }
  };

  // Restore persisted settings
  useEffect(() => {
    const savedScope = readSaved(STATS_KEYS.scope);
    if (savedScope) setScope(savedScope);

    const savedWeeks = readSaved(STATS_KEYS.weeksToShow);
    if (savedWeeks) setWeeksToShow(Number(savedWeeks));

    const savedTab = readSaved(STATS_KEYS.activeTab);
    if (savedTab) setActiveTab(Number(savedTab));
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    setError('');

    try {
      let data;
      if (scope === 'community' && selectedCommunity) {
        data = await api.community.stats(selectedCommunity, weeksToShow);
      } else {
        data = await api.results.getStatistics(selectedClan, weeksToShow);
      }

      // Debug: log returned data to diagnose empty charts
      console.log('Fetched statistics data:', data);

      if (!data || (Array.isArray(data.weeklyTotals) && data.weeklyTotals.length === 0)) {
        console.warn('Statistics: weeklyTotals empty or missing', { scope, selectedClan, selectedCommunity, data });
        setError('No weekly totals returned from server (check server logs).');
      } else {
        // clear any previous info
        setError('');
      }

      setWeeklyTotals(data.weeklyTotals || []);
      setWeeklyAverages(data.weeklyAverages || []);
      setClanGrowth(data.clanGrowth || []);
      setMemberGrowth(data.memberGrowth || []);

    } catch (error) {
      setError('Failed to fetch statistics');
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWeekLabel = (week) => {
    // Convert "2025-W05" to "W05"
    return week ? week.split('-')[1] : week;
  };

  // Calculate summary stats
  const getSummaryStats = () => {
    if (weeklyTotals.length < 2) return null;

    const latest = weeklyTotals[weeklyTotals.length - 1]?.total || 0;
    const first = weeklyTotals[0]?.total || 0;
    const totalGrowth = latest - first;
    const avgWeeklyGrowth = clanGrowth.length > 0
      ? Math.round(clanGrowth.reduce((sum, g) => sum + g.growth, 0) / clanGrowth.length)
      : 0;

    return { latest, first, totalGrowth, avgWeeklyGrowth };
  };

  // Calculate member stats from memberGrowth data
  const getMemberStats = () => {
    return memberGrowth
      .filter(m => m.isActive !== false)
      .map(member => {
      const scores = member.weeklyScores || [];
      const validScores = scores.filter(s => s.score !== null && s.score !== undefined);
      const totalScore = validScores.reduce((sum, s) => sum + s.score, 0);
      const averageScore = validScores.length > 0 ? Math.round(totalScore / validScores.length) : 0;

      // Determine last score (most recent week)
      const sortedScoresDesc = [...scores].sort((a, b) => (b.week || '').localeCompare(a.week || ''));
      const lastScoreEntry = sortedScoresDesc.find(s => s.score !== null && s.score !== undefined);
      const lastScore = lastScoreEntry ? lastScoreEntry.score : 0;

      // Count total missed boss days across all weeks
      const missedBossDays = scores.reduce((sum, s) => {
        let count = 0;
        if (s.missedBossDay1) count++;
        if (s.missedBossDay2) count++;
        if (s.missedBossDay3) count++;
        return sum + count;
      }, 0);

      return {
        playerName: member.playerName,
        memberId: member.memberId,
        clanName: member.clanName || null,
        bossLevel: member.bossLevel || null,
        totalResults: scores.length,
        totalScore,
        averageScore,
        lastScore,
        missedBossDays,
        weeksPlayed: member.weeksPlayed,
        totalGrowth: member.totalGrowth,
        avgImprovement: member.avgImprovement
      };
    }).sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0));
  };

  const summary = getSummaryStats();
  const memberStats = getMemberStats();

  return (
    <Container maxWidth="100%" sx={{ mt: 4, mb: 4, px: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        📊 Statistics & Analytics
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Scope"
                value={scope}
                onChange={(e) => { setScope(e.target.value); saveLocal(STATS_KEYS.scope, e.target.value); }}
                fullWidth
              >
                <MenuItem value="clan">This Clan</MenuItem>
                <MenuItem value="community">Community</MenuItem>
              </TextField>
            </Grid>
            {scope === 'clan' && (
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Select Clan"
                  value={selectedClan}
                  onChange={(e) => { setSelectedClan(e.target.value); saveLocal(STATS_KEYS.selectedClan, e.target.value); }}
                  fullWidth
                >
                  {clans.map((clan) => (
                    <MenuItem key={clan._id} value={clan._id}>
                      {clan.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {scope === 'community' && (
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Select Community"
                  value={selectedCommunity}
                  onChange={(e) => { setSelectedCommunity(e.target.value); saveLocal(STATS_KEYS.selectedCommunity, e.target.value); }}
                  fullWidth
                >
                  {communities.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Weeks to Display"
                value={weeksToShow}
                onChange={(e) => { setWeeksToShow(Number(e.target.value)); saveLocal(STATS_KEYS.weeksToShow, e.target.value); }}
                fullWidth
              >
                {weekOptions.map((w) => (
                  <MenuItem key={w} value={w}>
                    Last {w} weeks
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              {summary && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Growth ({weeksToShow} weeks)
                  </Typography>
                  <Typography variant="h5" color={summary.totalGrowth >= 0 ? 'success.main' : 'error.main'}>
                    {summary.totalGrowth >= 0 ? '+' : ''}{summary.totalGrowth.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg: {summary.avgWeeklyGrowth >= 0 ? '+' : ''}{summary.avgWeeklyGrowth.toLocaleString()}/week
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={(e, newValue) => { setActiveTab(newValue); saveLocal(STATS_KEYS.activeTab, newValue); }}>
              <Tab label="📊 Overall Statistics" />
              <Tab label="👥 Member Statistics" />
            </Tabs>
          </Box>

          {/* TAB 0: Overall Statistics */}
          {activeTab === 0 && (
            <Grid container spacing={3} direction="column">
              {/* Clan Total Score (Top 30) - rebuilt component */}
              <Grid item xs={12} sm={12} md={12} lg={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📈 Clan Total Score (Top 30)
                    </Typography>
                    {(() => {
                      // Defensive rendering: ensure weeklyTotals is an array of {week, total}
                      if (!Array.isArray(weeklyTotals) || weeklyTotals.length === 0) {
                        return <Typography color="text.secondary" sx={{ p: 2 }}>No data available</Typography>;
                      }

                      // Normalize and sort by week ascending
                      const data = weeklyTotals
                        .map(w => ({ week: w.week || '', total: Number(w.total || 0) }))
                        .filter(d => d.week)
                        .sort((a, b) => a.week.localeCompare(b.week));

                      // Log for debugging
                      console.debug('Rendering Clan Total Score with data:', data);

                      return (
                        <Box sx={{ width: '100%', height: { xs: 300, sm: 400, md: 500 } }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="week" tickFormatter={formatWeekLabel} interval={0} angle={-30} textAnchor="end" height={60} />
                              <YAxis tickFormatter={(v) => v.toLocaleString()} />
                              <Tooltip formatter={(value) => [value.toLocaleString(), 'Total Score']} labelFormatter={(label) => `Week: ${label}`} />
                              <Legend />
                              <Line type="monotone" dataKey="total" name="Total Score" stroke="#8884d8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>

              {/* Weekly Growth Bar Chart - Full Width */}
              <Grid item xs={12} sm={12} md={12} lg={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📊 Weekly Growth
                    </Typography>
                    {clanGrowth.length > 0 ? (
                      <Box sx={{ width: '100%', height: { xs: 300, sm: 400, md: 500 } }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={clanGrowth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="week"
                              tickFormatter={formatWeekLabel}
                              fontSize={12}
                            />
                            <YAxis
                              tickFormatter={(v) => v.toLocaleString()}
                              fontSize={12}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'growth') return [value.toLocaleString(), 'Growth'];
                                return [value + '%', 'Growth %'];
                              }}
                              labelFormatter={(label) => `Week: ${label}`}
                            />
                            <Legend />
                            <ReferenceLine y={0} stroke="#666" />
                            <Bar dataKey="growth" name="Growth">
                              {clanGrowth.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.growth >= 0 ? '#82ca9d' : '#ff7c7c'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <Typography color="text.secondary" sx={{ p: 2 }}>No data available</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Average Score per Member - Full Width */}
              <Grid item xs={12} sm={12} md={12} lg={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      👥 Average Score per Member
                    </Typography>
                    {weeklyAverages.length > 0 ? (
                      <Box sx={{ width: '100%', height: { xs: 300, sm: 400, md: 500 } }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weeklyAverages}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="week"
                              tickFormatter={formatWeekLabel}
                              fontSize={12}
                            />
                            <YAxis
                              tickFormatter={(v) => v.toLocaleString()}
                              fontSize={12}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'average') return [value.toLocaleString(), 'Avg Score'];
                                return [value, 'Members'];
                              }}
                              labelFormatter={(label) => `Week: ${label}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="average"
                              name="Avg Score"
                              stroke="#82ca9d"
                              strokeWidth={3}
                              dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <Typography color="text.secondary" sx={{ p: 2 }}>No data available</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* TAB 1: Member Statistics */}
          {activeTab === 1 && (
            <Grid container spacing={3} direction="column">
              {/* Member Stats Table - Full Width */}
              <Grid item xs={12} sm={12} md={12} lg={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      📋 Member Performance Details
                    </Typography>
                    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                      <Table stickyHeader size="small" sx={{ minWidth: { xs: 720, sm: 900 } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Player</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }}>Boss Lv</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Last Score</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Avg Score</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Weeks</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Growth</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Avg Δ/Week</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'background.paper' }} align="right">Missed Boss</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {memberStats.map((stat, index) => (
                            <TableRow
                              key={stat.memberId}
                              hover
                            >
                              <TableCell>{index + 1}</TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span>{stat.playerName}</span>
                                  {stat.clanName ? (() => {
                                    const { color, textColor } = getColorForString(stat.clanName);
                                    return (
                                      <Chip
                                        label={stat.clanName}
                                        size="small"
                                        sx={{ ml: 0.5, backgroundColor: color, color: textColor, fontWeight: 600 }}
                                      />
                                    );
                                  })() : null}
                                </Box>
                              </TableCell>
                              <TableCell align="center">{stat.bossLevel !== null && stat.bossLevel !== undefined ? stat.bossLevel : '-'}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                                {stat.lastScore.toLocaleString()}
                              </TableCell>
                              <TableCell align="right">{stat.averageScore.toLocaleString()}</TableCell>
                              <TableCell align="right">{stat.weeksPlayed || stat.totalResults}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color: (stat.totalGrowth || 0) >= 0 ? 'success.main' : 'error.main',
                                  fontWeight: 'bold'
                                }}
                              >
                                {stat.totalGrowth !== undefined ? (
                                  `${stat.totalGrowth >= 0 ? '+' : ''}${stat.totalGrowth.toLocaleString()}`
                                ) : '-'}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color: (stat.avgImprovement || 0) >= 0 ? 'success.main' : 'error.main',
                                  fontWeight: 'bold'
                                }}
                              >
                                {stat.avgImprovement !== null && stat.avgImprovement !== undefined ? (
                                  `${stat.avgImprovement >= 0 ? '+' : ''}${stat.avgImprovement.toLocaleString()}`
                                ) : '-'}
                              </TableCell>
                              <TableCell align="right">
                                {stat.missedBossDays > 0 ? (
                                  <Chip label={stat.missedBossDays} size="small" color="error" />
                                ) : (
                                  <Typography variant="body2" color="text.secondary">0</Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default Statistics;
