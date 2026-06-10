import { handleRequest } from '../server/grading-server.mjs';

export default function handler(req, res) {
  return handleRequest(req, res);
}
