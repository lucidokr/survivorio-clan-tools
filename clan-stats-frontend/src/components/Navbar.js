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
  ListItemIcon
} from '@mui/material';
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

  return (
    <AppBar position="static">
      <Toolbar>
        <TrendingUpIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Clan Stats Tracker
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
