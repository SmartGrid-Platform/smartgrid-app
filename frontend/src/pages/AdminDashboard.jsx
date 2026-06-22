import React, { useState, useEffect } from 'react';
import { authApi, billingApi, consumerApi, meterApi } from '../utils/api';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  MenuItem,
  Chip,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  People as UsersIcon,
  AttachMoney as TariffsIcon,
  Dashboard as AnalyticsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  OfflineBolt as MeterIcon,
  Receipt as BillIcon,
  AccountBox as ConsumerIcon
} from '@mui/icons-material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [meters, setMeters] = useState([]);
  const [bills, setBills] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', id: null, message: '' });
  const [openRegisterUser, setOpenRegisterUser] = useState(false);
  const [openCreateTariff, setOpenCreateTariff] = useState(false);
  const [openEditTariff, setOpenEditTariff] = useState(false);
  const [openEditUser, setOpenEditUser] = useState(false);
  const [openProvisionMeter, setOpenProvisionMeter] = useState(false);

  // Form Inputs
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [newTariff, setNewTariff] = useState({ tariff_name: '', tariff_type: 'Residential', rate_per_unit: '', fixed_charge: '0.00', status: 'ACTIVE', description: '', date: '' });
  const [editTariffData, setEditTariffData] = useState({ id: '', tariff_name: '', tariff_type: 'Residential', rate_per_unit: '', fixed_charge: '0.00', status: 'ACTIVE', description: '', date: '' });
  const [editUserData, setEditUserData] = useState({ id: '', name: '', email: '', password: '', status: 'ACTIVE' });
  const [newMeterNumber, setNewMeterNumber] = useState('');
  const [newMeterType, setNewMeterType] = useState('SMART');
  const [newMeterInstallationDate, setNewMeterInstallationDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMeterStatus, setNewMeterStatus] = useState('ACTIVE');
  const [newMeterTariffId, setNewMeterTariffId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const uRes = await authApi.get('/auth/users');
      setUsers(Array.isArray(uRes.data) ? uRes.data : []);

      const tRes = await billingApi.get('/tariffs');
      setTariffs(Array.isArray(tRes.data) ? tRes.data : []);

      const cRes = await consumerApi.get('/consumers');
      setConsumers(Array.isArray(cRes.data) ? cRes.data : []);

      const mRes = await meterApi.get('/meters');
      setMeters(Array.isArray(mRes.data) ? mRes.data : []);

      const bRes = await billingApi.get('/bills');
      setBills(Array.isArray(bRes.data) ? bRes.data : []);
    } catch (err) {
      console.error('[ERROR] AdminDashboard fetchData error:', err);
      setError('Error fetching administrative records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
  };

  // Register user (Admin creation)
  const handleRegisterUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    try {
      await authApi.post('/auth/register', newUser);
      setSuccess('User created successfully!');
      setNewUser({ name: '', email: '', password: '', role: 'STAFF' });
      fetchData();
      setTimeout(() => {
        setOpenRegisterUser(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  };

  // Edit user (status and details)
  const handleOpenEditUser = (u) => {
    setEditUserData({ id: u.id, name: u.name, email: u.email, password: '', status: u.status });
    setOpenEditUser(true);
  };

  const handleEditUser = async () => {
    if (!editUserData.name || !editUserData.email) {
      setError('Name and Email are required.');
      return;
    }
    setError('');
    try {
      const updatePayload = {
        name: editUserData.name,
        email: editUserData.email,
        status: editUserData.status
      };
      if (editUserData.password) {
        updatePayload.password = editUserData.password;
      }
      await authApi.put(`/auth/users/${editUserData.id}`, updatePayload);
      setSuccess('User updated successfully!');
      fetchData();
      setTimeout(() => {
        setOpenEditUser(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user.');
    }
  };

  // Configure Tariff
  const handleCreateTariff = async () => {
    if (!newTariff.tariff_name || newTariff.rate_per_unit === undefined || !newTariff.date) {
      setError('Please fill in all required fields (Name, Rate, Effective Date).');
      return;
    }
    setError('');
    try {
      await billingApi.post('/tariffs', {
        tariff_name: newTariff.tariff_name,
        tariff_type: newTariff.tariff_type,
        rate_per_unit: parseFloat(newTariff.rate_per_unit),
        fixed_charge: parseFloat(newTariff.fixed_charge || 0),
        status: newTariff.status,
        description: newTariff.description,
        effective_date: newTariff.date
      });
      setSuccess('Tariff schema created successfully!');
      setNewTariff({ tariff_name: '', tariff_type: 'Residential', rate_per_unit: '', fixed_charge: '0.00', status: 'ACTIVE', description: '', date: '' });
      fetchData();
      setTimeout(() => {
        setOpenCreateTariff(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to configure tariff.');
    }
  };

  const handleOpenEditTariff = (t) => {
    setEditTariffData({
      id: t.id,
      tariff_name: t.tariff_name,
      tariff_type: t.tariff_type || 'Residential',
      rate_per_unit: t.rate_per_unit,
      fixed_charge: t.fixed_charge || 0,
      status: t.status || 'ACTIVE',
      description: t.description || '',
      date: t.effective_date
    });
    setOpenEditTariff(true);
  };

  const handleEditTariff = async () => {
    if (!editTariffData.tariff_name || editTariffData.rate_per_unit === undefined || !editTariffData.date) {
      setError('Name, rate, and effective date are required.');
      return;
    }
    setError('');
    try {
      await billingApi.put(`/tariffs/${editTariffData.id}`, {
        tariff_name: editTariffData.tariff_name,
        tariff_type: editTariffData.tariff_type,
        rate_per_unit: parseFloat(editTariffData.rate_per_unit),
        fixed_charge: parseFloat(editTariffData.fixed_charge || 0),
        status: editTariffData.status,
        description: editTariffData.description,
        effective_date: editTariffData.date
      });
      setSuccess('Tariff updated successfully!');
      fetchData();
      setTimeout(() => {
        setOpenEditTariff(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update tariff.');
    }
  };

  const handleDeleteTariff = async (id) => {
    if (window.confirm('Are you sure you want to delete this tariff?')) {
      setError('');
      try {
        await billingApi.delete(`/tariffs/${id}`);
        setSuccess('Tariff deleted successfully!');
        fetchData();
        setTimeout(() => setSuccess(''), 2000);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete tariff.');
      }
    }
  };

  // Provision New Meter
  const handleProvisionMeter = async () => {
    if (!newMeterNumber) {
      setError('Meter number is required.');
      return;
    }
    setError('');
    try {
      await meterApi.post('/meters', {
        meter_number: newMeterNumber,
        meter_type: newMeterType,
        installation_date: newMeterInstallationDate,
        status: newMeterStatus,
        tariff_id: newMeterTariffId ? parseInt(newMeterTariffId, 10) : null
      });
      setSuccess('Smart Meter provisioned successfully!');
      setNewMeterNumber('');
      setNewMeterType('SMART');
      setNewMeterInstallationDate(new Date().toISOString().split('T')[0]);
      setNewMeterStatus('ACTIVE');
      setNewMeterTariffId('');
      fetchData();
      setTimeout(() => {
        setOpenProvisionMeter(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to provision meter.');
    }
  };

  // Delete dialog trigger helper
  const triggerDeleteConfirm = (type, id, message) => {
    setDeleteConfirm({ open: true, type, id, message });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirm;
    setDeleteConfirm({ open: false, type: '', id: null, message: '' });
    setError('');
    setSuccess('');
    try {
      if (type === 'consumer') {
        await consumerApi.delete(`/consumers/${id}`);
        setSuccess('Consumer profile deleted successfully.');
      } else if (type === 'meter') {
        await meterApi.delete(`/meters/${id}`);
        setSuccess('Smart meter deleted successfully.');
      } else if (type === 'bill') {
        await billingApi.delete(`/bills/${id}`);
        setSuccess('Bill deleted successfully.');
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to delete ${type}.`);
    }
  };

  // Statistics Data
  const safeUsers = Array.isArray(users) ? users : [];
  const adminCount = safeUsers.filter(u => u?.role === 'ADMIN').length;
  const staffCount = safeUsers.filter(u => u?.role === 'STAFF').length;
  const consumerCountData = safeUsers.filter(u => u?.role === 'CONSUMER').length;

  const usersRoleChartData = [
    { name: 'Admin', count: adminCount },
    { name: 'Staff', count: staffCount },
    { name: 'Consumer', count: consumerCountData }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontFamily: 'Outfit', fontWeight: 800 }}>
        Super Admin Control Panel
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} textColor="secondary" indicatorColor="secondary">
          <Tab label="Analytics" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="User Accounts" icon={<UsersIcon />} iconPosition="start" />
          <Tab label="Consumers" icon={<ConsumerIcon />} iconPosition="start" />
          <Tab label="Smart Meters" icon={<MeterIcon />} iconPosition="start" />
          <Tab label="Bills" icon={<BillIcon />} iconPosition="start" />
          <Tab label="Tariff Rates" icon={<TariffsIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* 0. ANALYTICS PANEL */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Total System Users
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
                  {users.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Consumers Profiles
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
                  {consumers.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Smart Meters Active
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
                  {meters.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                  Current Tariffs Defined
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
                  {tariffs.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Bar Chart of User Roles */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, color: '#26C6DA', fontFamily: 'Outfit', fontWeight: 700 }}>
                  Platform Account Distribution (By Role)
                </Typography>
                <Box sx={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usersRoleChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(38, 198, 218, 0.05)" />
                      <XAxis dataKey="name" stroke="#B0BEC5" fontSize={11} />
                      <YAxis stroke="#B0BEC5" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#102733', border: '1px solid rgba(0, 183, 194, 0.3)' }} />
                      <Bar dataKey="count" fill="#26C6DA" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 1. USER ACCOUNTS PANEL */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenRegisterUser(true)}>
              Add System User
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Registered At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(users) ? users : []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.id}</TableCell>
                    <TableCell><strong>{u.name}</strong></TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip label={u.role} color={u.role === 'ADMIN' ? 'error' : 'info'} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={u.status} color={u.status === 'ACTIVE' ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>{new Date(u.createdAt || u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" color="secondary" onClick={() => handleOpenEditUser(u)}>
                        Edit / Toggle Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 2. CONSUMERS PANEL */}
      {activeTab === 2 && (
        <Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Consumer Number</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(consumers) ? consumers : []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell><strong>{c.consumer_number}</strong></TableCell>
                    <TableCell>{c.user?.name}</TableCell>
                    <TableCell>{c.user?.email}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.address}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#00B7C2' }}>₹{parseFloat(c.balance).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip label={c.connection_status} color={c.connection_status === 'CONNECTED' ? 'success' : 'error'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('consumer', c.id, 'Are you sure you want to permanently delete this consumer profile and their login user account?')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 3. SMART METERS PANEL */}
      {activeTab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenProvisionMeter(true)}>
              Provision Smart Meter
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Meter Number</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Tariff Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Consumer ID</TableCell>
                  <TableCell>Installation Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(meters) ? meters : []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.id}</TableCell>
                    <TableCell><strong>{m.meter_number}</strong></TableCell>
                    <TableCell>{m.meter_type || 'SMART'}</TableCell>
                    <TableCell>{m.tariff ? m.tariff.tariff_name : 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={m.status} color={m.status === 'ACTIVE' ? 'success' : m.status === 'TAMPERED' ? 'error' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>{m.consumer_id || 'Unassigned'}</TableCell>
                    <TableCell>{m.installation_date || 'N/A'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('meter', m.id, 'Are you sure you want to permanently delete this smart meter and its reading history?')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 4. BILLS PANEL */}
      {activeTab === 4 && (
        <Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Consumer ID</TableCell>
                  <TableCell>Billing Month</TableCell>
                  <TableCell>Units Used (kWh)</TableCell>
                  <TableCell>Amount (₹)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Invoice Key</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(bills) ? bills : []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.id}</TableCell>
                    <TableCell>{b.consumer_id}</TableCell>
                    <TableCell><strong>{b.billing_month}</strong></TableCell>
                    <TableCell>{parseFloat(b.units_used).toFixed(2)}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#00B7C2' }}>₹{parseFloat(b.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip label={b.status} color={b.status === 'PAID' ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>{b.pdf_path}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('bill', b.id, 'Are you sure you want to delete this bill? This will also remove the statement HTML file from S3 bucket.')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 5. TARIFF PANEL */}
      {activeTab === 5 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenCreateTariff(true)}>
              Configure New Tariff
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Tariff Plan Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Rate Per kWh (₹)</TableCell>
                  <TableCell>Fixed Charge (₹)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(tariffs) ? tariffs : []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.id}</TableCell>
                    <TableCell><strong>{t.tariff_name}</strong></TableCell>
                    <TableCell>{t.tariff_type || 'N/A'}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#00B7C2' }}>
                      ₹{parseFloat(t.rate_per_unit).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      ₹{parseFloat(t.fixed_charge || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={t.status || 'ACTIVE'} 
                        color={(t.status || 'ACTIVE') === 'ACTIVE' ? 'success' : 'error'} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description || 'No description'}
                    </TableCell>
                    <TableCell>{t.effective_date}</TableCell>
                    <TableCell>{new Date(t.createdAt || t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" color="primary" sx={{ mr: 1 }} onClick={() => handleOpenEditTariff(t)}>Edit</Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteTariff(t.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* DIALOGS */}

      {/* 1. Register User Dialog */}
      <Dialog open={openRegisterUser} onClose={() => setOpenRegisterUser(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Create System User Account</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          <TextField label="User Full Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} fullWidth />
          <TextField label="Email Address" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} fullWidth />
          <TextField label="Secure Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} fullWidth />
          <TextField
            select
            label="Assigned System Role"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            fullWidth
          >
            <MenuItem value="STAFF">STAFF</MenuItem>
            <MenuItem value="ADMIN">ADMIN</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenRegisterUser(false)} color="inherit">Cancel</Button>
          <Button onClick={handleRegisterUser} color="secondary" variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* 2. Edit User Dialog */}
      <Dialog open={openEditUser} onClose={() => setOpenEditUser(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Modify User Settings</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          <TextField label="User Full Name" value={editUserData.name} onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })} fullWidth />
          <TextField label="Email Address" value={editUserData.email} onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })} fullWidth />
          <TextField label="New Password (Leave blank to keep current)" type="password" value={editUserData.password} onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })} fullWidth />
          <TextField
            select
            label="System Status"
            value={editUserData.status}
            onChange={(e) => setEditUserData({ ...editUserData, status: e.target.value })}
            fullWidth
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenEditUser(false)} color="inherit">Cancel</Button>
          <Button onClick={handleEditUser} color="secondary" variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* 3. Configure Tariff Dialog */}
      <Dialog open={openCreateTariff} onClose={() => setOpenCreateTariff(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Configure Tariff Plan</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Tariff Name" placeholder="e.g. Residential Peak Plan" value={newTariff.tariff_name} onChange={(e) => setNewTariff({ ...newTariff, tariff_name: e.target.value })} fullWidth />
          <TextField
            select
            label="Tariff Type"
            value={newTariff.tariff_type}
            onChange={(e) => setNewTariff({ ...newTariff, tariff_type: e.target.value })}
            fullWidth
          >
            <MenuItem value="Residential">Residential</MenuItem>
            <MenuItem value="Commercial">Commercial</MenuItem>
            <MenuItem value="Industrial">Industrial</MenuItem>
          </TextField>
          <TextField label="Rate (₹ per kWh)" type="number" placeholder="e.g. 6.50" value={newTariff.rate_per_unit} onChange={(e) => setNewTariff({ ...newTariff, rate_per_unit: e.target.value })} fullWidth />
          <TextField label="Fixed Charge (₹)" type="number" placeholder="e.g. 100.00" value={newTariff.fixed_charge} onChange={(e) => setNewTariff({ ...newTariff, fixed_charge: e.target.value })} fullWidth />
          <TextField
            select
            label="Status"
            value={newTariff.status}
            onChange={(e) => setNewTariff({ ...newTariff, status: e.target.value })}
            fullWidth
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
          <TextField label="Description" placeholder="Description of the plan" multiline rows={2} value={newTariff.description} onChange={(e) => setNewTariff({ ...newTariff, description: e.target.value })} fullWidth />
          <TextField
            type="date"
            label="Effective Date"
            InputLabelProps={{ shrink: true }}
            value={newTariff.date}
            onChange={(e) => setNewTariff({ ...newTariff, date: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenCreateTariff(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreateTariff} color="secondary" variant="contained">Configure</Button>
        </DialogActions>
      </Dialog>

      {/* 3.1 Edit Tariff Dialog */}
      <Dialog open={openEditTariff} onClose={() => setOpenEditTariff(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Edit Tariff Plan</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Tariff Name" placeholder="e.g. Residential Peak Plan" value={editTariffData.tariff_name} onChange={(e) => setEditTariffData({ ...editTariffData, tariff_name: e.target.value })} fullWidth />
          <TextField
            select
            label="Tariff Type"
            value={editTariffData.tariff_type}
            onChange={(e) => setEditTariffData({ ...editTariffData, tariff_type: e.target.value })}
            fullWidth
          >
            <MenuItem value="Residential">Residential</MenuItem>
            <MenuItem value="Commercial">Commercial</MenuItem>
            <MenuItem value="Industrial">Industrial</MenuItem>
          </TextField>
          <TextField label="Rate (₹ per kWh)" type="number" placeholder="e.g. 6.50" value={editTariffData.rate_per_unit} onChange={(e) => setEditTariffData({ ...editTariffData, rate_per_unit: e.target.value })} fullWidth />
          <TextField label="Fixed Charge (₹)" type="number" placeholder="e.g. 100.00" value={editTariffData.fixed_charge} onChange={(e) => setEditTariffData({ ...editTariffData, fixed_charge: e.target.value })} fullWidth />
          <TextField
            select
            label="Status"
            value={editTariffData.status}
            onChange={(e) => setEditTariffData({ ...editTariffData, status: e.target.value })}
            fullWidth
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
          <TextField label="Description" placeholder="Description of the plan" multiline rows={2} value={editTariffData.description} onChange={(e) => setEditTariffData({ ...editTariffData, description: e.target.value })} fullWidth />
          <TextField
            type="date"
            label="Effective Date"
            InputLabelProps={{ shrink: true }}
            value={editTariffData.date}
            onChange={(e) => setEditTariffData({ ...editTariffData, date: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenEditTariff(false)} color="inherit">Cancel</Button>
          <Button onClick={handleEditTariff} color="secondary" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* 4. Provision Meter Dialog */}
      <Dialog open={openProvisionMeter} onClose={() => setOpenProvisionMeter(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Provision New Smart Meter</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField label="Meter Serial Number" placeholder="e.g. MTR-9840294" value={newMeterNumber} onChange={(e) => setNewMeterNumber(e.target.value)} fullWidth />
          <TextField
            select
            label="Meter Type"
            value={newMeterType}
            onChange={(e) => setNewMeterType(e.target.value)}
            fullWidth
          >
            <MenuItem value="SMART">SMART</MenuItem>
            <MenuItem value="PREPAID">PREPAID</MenuItem>
            <MenuItem value="BI-DIRECTIONAL">BI-DIRECTIONAL</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="Installation Date"
            InputLabelProps={{ shrink: true }}
            value={newMeterInstallationDate}
            onChange={(e) => setNewMeterInstallationDate(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Status"
            value={newMeterStatus}
            onChange={(e) => setNewMeterStatus(e.target.value)}
            fullWidth
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
          <TextField
            select
            label="Tariff Plan"
            value={newMeterTariffId}
            onChange={(e) => setNewMeterTariffId(e.target.value)}
            fullWidth
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {tariffs.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.tariff_name} (₹{parseFloat(t.rate_per_unit).toFixed(2)}/kWh)</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenProvisionMeter(false)} color="inherit">Cancel</Button>
          <Button onClick={handleProvisionMeter} color="secondary" variant="contained">Provision</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ ...deleteConfirm, open: false })}>
        <DialogTitle sx={{ backgroundColor: '#102733', fontFamily: 'Outfit', fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', minWidth: 320, pt: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'Outfit', color: '#B0BEC5' }}>
            {deleteConfirm.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733', pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteConfirm({ ...deleteConfirm, open: false })} color="inherit">Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default AdminDashboard;
