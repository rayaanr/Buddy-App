-- Separate database for the API's integration tests (they wipe data between tests).
CREATE DATABASE buddy_test;
\c buddy_test
CREATE EXTENSION IF NOT EXISTS postgis;
