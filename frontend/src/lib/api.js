import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  listObjects: (params = {}) => client.get("/objects", { params }).then((r) => r.data),
  getObject: (id) => client.get(`/objects/${id}`).then((r) => r.data),
  createObject: (data) => client.post("/objects", data).then((r) => r.data),
  updateObject: (id, data) => client.put(`/objects/${id}`, data).then((r) => r.data),
  deleteObject: (id) => client.delete(`/objects/${id}`).then((r) => r.data),
  enhanceObject: (id) => client.post(`/objects/${id}/ai-enhance`).then((r) => r.data),
  relatedObjects: (id) => client.get(`/objects/${id}/related`).then((r) => r.data),
  stats: () => client.get("/stats").then((r) => r.data),
};
