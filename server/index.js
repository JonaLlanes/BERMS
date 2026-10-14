const path = require('path');
const express = require('express');
const equipmentRoutes = require('./routes/equipment');
const historyRoutes = require('./routes/history');
const summaryRoutes = require('./routes/summary');
const requestRoutes = require('./routes/requests');
const reportRoutes = require('./routes/reports');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/summary', summaryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/service-requests', requestRoutes);
app.use('/api/equipment', historyRoutes);
app.use('/api/equipment', equipmentRoutes);

app.listen(port, () => {
  console.log(`Biomedical Equipment Records Management System running at http://localhost:${port}`);
});
