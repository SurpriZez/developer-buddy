// Runs after Jest framework is installed — beforeEach is available here.
import { clearStore } from './setup';

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
});
