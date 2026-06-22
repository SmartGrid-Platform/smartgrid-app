import React, { useState, useEffect } from 'react';
import { alertApi, authApi, meterApi } from '../utils/api';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
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
  TextField,
  Chip,
  Avatar,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Security as TamperIcon,
  Assignment as InspectionIcon,
  Assessment as ReportsIcon,
  Group as StaffIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const SupervisorDashboard = () => {
  const [inspections, setInspections] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Assignment Modal States
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch inspections
      const insRes = await alertApi.get('/inspections');
      console.log('[DEBUG] SupervisorDashboard Inspections Response:', insRes.data);
      setInspections(Array.isArray(insRes.data) ? insRes.data : []);

      // Fetch users to filter STAFF & SUPERVISORS
      const usersRes = await authApi.get('/auth/users');
      console.log('[DEBUG] SupervisorDashboard Users Response:', usersRes.data);
      const userData = Array.isArray(usersRes.data) ? usersRes.data : [];
      const filteredStaff = userData.filter(u => u?.role === 'STAFF' || u?.role === 'SUPERVISOR');
      setStaffList(filteredStaff);

      // Fetch meters to check tamper cases
      const meterRes = await meterApi.get('/meters');
      console.log('[DEBUG] SupervisorDashboard Meters Response:', meterRes.data);
      setMeters(Array.isArray(meterRes.data) ? meterRes.data : []);
    } catch (err) {
      console.error('[ERROR] SupervisorDashboard fetchData error:', err);
      setError('Failed to fetch supervisor portal records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAssign = (inspection) => {
    setSelectedInspection(inspection);
    setAssigneeId(inspection.assigned_to || '');
    setInspectionStatus(inspection.status);
    setOpenAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedInspection) return;
    setError('');
    setSuccess('');
    try {
      await alertApi.put(`/inspections/${selectedInspection.id}`, {
        assigned_to: assigneeId ? parseInt(assigneeId, 10) : null,
        status: inspectionStatus
      });
      setSuccess('Inspection updated successfully!');
      fetchData();
      setTimeout(() => {
        setOpenAssignModal(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError('Failed to update inspection details.');
    }
  };

  // Compile statistics
  const safeMeters = Array.isArray(meters) ? meters : [];
  const safeInspections = Array.isArray(inspections) ? inspections : [];
  const safeStaffList = Array.isArray(staffList) ? staffList : [];

  const tamperedMeters = safeMeters.filter(m => m?.status === 'TAMPERED');
  const pendingInspections = safeInspections.filter(i => i?.status === 'PENDING');
  const completedInspections = safeInspections.filter(i => i?.status === 'COMPLETED');
  
  // Chart Data: Inspection Status Breakdown
  const inspectionPieData = [
    { name: 'Pending', value: pendingInspections.length, color: '#FFB74D' },
    { name: 'Completed', value: completedInspections.length, color: '#00B7C2' },
    { name: 'Cancelled', value: safeInspections.filter(i => i?.status === 'CANCELLED').length, color: '#ef5350' }
  ].filter(item => item.value > 0);

  // Chart Data: Staff Workload (Pending inspections count per staff member)
  const staffWorkloadData = safeStaffList.map(s => {
    const pendingCount = safeInspections.filter(i => i?.assigned_to === s?.id && i?.status === 'PENDING').length;
    return {
      name: s?.name || 'Unknown',
      'Pending Tasks': pendingCount
    };
  });

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" sx={{ mb: 4, fontFamily: 'Outfit', fontWeight: 800 }}>
          Supervisor Dashboard & Inspections
        </Typography>
      </Grid>

      {/* 1. Metric Overview Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '6px solid #FF9800' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                Pending Investigations
              </Typography>
              <InspectionIcon sx={{ color: '#FF9800' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
              {pendingInspections.length}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '6px solid #ef5350' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                Active Tamper Alerts
              </Typography>
              <TamperIcon sx={{ color: '#ef5350' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
              {tamperedMeters.length}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '6px solid #00B7C2' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                Jobs Completed
              </Typography>
              <ReportsIcon sx={{ color: '#00B7C2' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
              {completedInspections.length}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ borderLeft: '6px solid #26C6DA' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 600 }}>
                Field Operators Active
              </Typography>
              <StaffIcon sx={{ color: '#26C6DA' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, fontFamily: 'Outfit' }}>
              {staffList.length}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* 2. Visual Reports & Analytics Chart */}
      <Grid item xs={12} md={7}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, color: '#26C6DA', fontFamily: 'Outfit', fontWeight: 700 }}>
              Staff Pending Workload Distribution
            </Typography>
            {staffWorkloadData.length === 0 ? (
              <Box sx={{ py: 6, textCenter: 'center' }}>No staff configured.</Box>
            ) : (
              <Box sx={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffWorkloadData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(38, 198, 218, 0.05)" />
                    <XAxis dataKey="name" stroke="#B0BEC5" fontSize={11} />
                    <YAxis stroke="#B0BEC5" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#102733', border: '1px solid rgba(0, 183, 194, 0.3)' }} />
                    <Bar dataKey="Pending Tasks" fill="#00B7C2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, color: '#26C6DA', fontFamily: 'Outfit', fontWeight: 700 }}>
              Inspection Status Share
            </Typography>
            {inspectionPieData.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center', color: '#B0BEC5' }}>No inspections data found.</Box>
            ) : (
              <Box sx={{ height: 260, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inspectionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {inspectionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* 3. Inspections & Tamper Actions List */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#26C6DA', fontFamily: 'Outfit', fontWeight: 700 }}>
              Field Inspection Requests & Assignments
            </Typography>
            {inspections.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: '#B0BEC5' }}>
                No active inspections are currently requested.
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Consumer #</TableCell>
                      <TableCell>Address</TableCell>
                      <TableCell>Reason for Inspection</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Assigned Operator</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {safeInspections.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{i.id}</TableCell>
                        <TableCell><strong>{i?.consumer ? i.consumer.consumer_number : 'N/A'}</strong></TableCell>
                        <TableCell>{i?.consumer ? i.consumer.address : '-'}</TableCell>
                        <TableCell>{i?.reason}</TableCell>
                        <TableCell>
                          <Chip
                            label={i?.status}
                            color={i?.status === 'COMPLETED' ? 'success' : i?.status === 'PENDING' ? 'warning' : 'error'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {i?.assignedUser && i.assignedUser.name ? (
                            <Chip avatar={<Avatar>{(i.assignedUser.name || ' ')[0]}</Avatar>} label={i.assignedUser.name} variant="outlined" size="small" />
                          ) : (
                            <span style={{ color: '#ef5350', fontSize: '12px' }}>Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" color="secondary" onClick={() => handleOpenAssign(i)}>
                            Assign / Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* 4. Assign Inspector Dialog */}
      <Dialog open={openAssignModal} onClose={() => setOpenAssignModal(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>
          Update Inspection Status & Assignment
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          
          <TextField
            select
            label="Assign Operator"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            fullWidth
          >
            <MenuItem value=""><em>Unassigned</em></MenuItem>
            {safeStaffList.map((s) => (
              <MenuItem key={s?.id} value={s?.id}>
                {s?.name || 'Unknown'} ({s?.role || 'STAFF'})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={inspectionStatus}
            onChange={(e) => setInspectionStatus(e.target.value)}
            fullWidth
          >
            <MenuItem value="PENDING">PENDING</MenuItem>
            <MenuItem value="COMPLETED">COMPLETED</MenuItem>
            <MenuItem value="CANCELLED">CANCELLED</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenAssignModal(false)} color="inherit">Cancel</Button>
          <Button onClick={handleAssignSubmit} color="secondary" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default SupervisorDashboard;
