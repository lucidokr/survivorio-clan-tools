import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  ListItemIcon,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { Link, useLocation } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAIL = 'lucido.kristian@gmail.com';

const Navbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [navAnchorEl, setNavAnchorEl] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const isActive = (path) => location.pathname === path;

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  const handleNavOpen = (event) => setNavAnchorEl(event.currentTarget);
  const handleNavClose = () => setNavAnchorEl(null);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <AppBar position="static">
      <Toolbar>
        <TrendingUpIcon sx={{ mr: 2 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="div">
            Survivor Clan Tracker
          </Typography>
          <Typography variant="caption" component="div" color="text.secondary">
            Sponsored by UTC
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {!isSmall ? (
            <>
              <Button
                color="inherit"
                component={Link}
                to="/"
                variant={isActive('/') ? 'outlined' : 'text'}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/my-clan"
                variant={isActive('/my-clan') ? 'outlined' : 'text'}
              >
                My Clan
              </Button>
              {user?.email === ADMIN_EMAIL && (
                <Button
                  color="inherit"
                  component={Link}
                  to="/communities"
                  variant={isActive('/communities') ? 'outlined' : 'text'}
                >
                  Communities
                </Button>
              )}
              
              <Button
                color="inherit"
                component={Link}
                to="/members"
                variant={isActive('/members') ? 'outlined' : 'text'}
              >
                Members
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/upload-results"
                variant={isActive('/upload-results') ? 'outlined' : 'text'}
              >
                Results
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/statistics"
                variant={isActive('/statistics') ? 'outlined' : 'text'}
              >
                Statistics
              </Button>
            </>
          ) : (
            <>
              <IconButton color="inherit" onClick={openDrawer} aria-label="open navigation">
                <MenuIcon />
              </IconButton>
              <Drawer anchor="left" open={drawerOpen} onClose={closeDrawer}>
                <Box sx={{ width: 260 }} role="presentation">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
                    <Box>
                      <Typography variant="h6">Menu</Typography>
                    </Box>
                    <IconButton onClick={closeDrawer} aria-label="close navigation">
                      <CloseIcon />
                    </IconButton>
                  </Box>
                  <Divider />
                  <List>
                    <ListItem disablePadding>
                      <ListItemButton component={Link} to="/" onClick={closeDrawer} selected={isActive('/')}>
                        <ListItemText primary="Dashboard" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton component={Link} to="/my-clan" onClick={closeDrawer} selected={isActive('/my-clan')}>
                        <ListItemText primary="My Clan" />
                      </ListItemButton>
                    </ListItem>
                    {user?.email === ADMIN_EMAIL && (
                      <ListItem disablePadding>
                        <ListItemButton component={Link} to="/communities" onClick={closeDrawer} selected={isActive('/communities')}>
                          <ListItemText primary="Communities" />
                        </ListItemButton>
                      </ListItem>
                    )}
                    <ListItem disablePadding>
                      <ListItemButton component={Link} to="/members" onClick={closeDrawer} selected={isActive('/members')}>
                        <ListItemText primary="Members" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton component={Link} to="/upload-results" onClick={closeDrawer} selected={isActive('/upload-results')}>
                        <ListItemText primary="Results" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton component={Link} to="/statistics" onClick={closeDrawer} selected={isActive('/statistics')}>
                        <ListItemText primary="Statistics" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Box>
              </Drawer>
            </>
          )}

          {/* User Menu */}
          <IconButton onClick={handleMenuOpen} sx={{ ml: 2 }}>
            <Avatar
              src={user?.picture}
              alt={user?.name}
              sx={{ width: 32, height: 32 }}
            >
              {user?.name?.charAt(0) || <PersonIcon />}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2">{user?.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {user?.email}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
