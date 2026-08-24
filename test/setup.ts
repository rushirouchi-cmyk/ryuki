import { config } from 'dotenv';

// Integration tests read DATABASE_URL from .env.local (falling back to .env).
config({ path: '.env.local' });
config({ path: '.env' });
