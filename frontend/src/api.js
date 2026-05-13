import axios from 'axios';

const BASE = '/api';

export const getTasks = () => axios.get(`${BASE}/tasks`).then(r => r.data);

export const createTask = (task) => axios.post(`${BASE}/tasks`, task).then(r => r.data);

export const updateTask = (id, updates) => axios.put(`${BASE}/tasks/${id}`, updates).then(r => r.data);

export const deleteTask = (id) => axios.delete(`${BASE}/tasks/${id}`);

export const getCompletedTasks = (startDate, endDate) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  return axios.get(`${BASE}/completed`, { params }).then(r => r.data);
};

export const getArchivedTasks = (startDate, endDate) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  return axios.get(`${BASE}/archived`, { params }).then(r => r.data);
};

export const getSettings = () => axios.get(`${BASE}/settings`).then(r => r.data);

export const updateSettings = (settings) => axios.put(`${BASE}/settings`, settings).then(r => r.data);
