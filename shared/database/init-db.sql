-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create any additional setup here if needed
SELECT 'PostgreSQL with pgvector extension initialized successfully' as status; 