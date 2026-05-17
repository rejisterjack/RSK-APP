"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../src/generated/prisma/client");
const redis_1 = require("@upstash/redis");
async function runDiagnostics() {
    console.log('--- RAG STARTER KIT DIAGNOSTICS ---');
    console.log('Current time:', new Date().toISOString());
    // 1. Check Redis
    console.log('\n[Redis] Testing connection...');
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    console.log('Redis URL:', redisUrl);
    if (redisUrl && redisToken) {
        const redis = new redis_1.Redis({ url: redisUrl, token: redisToken });
        const start = Date.now();
        try {
            const pingRes = await redis.ping();
            console.log(`[Redis] Success! Ping result: "${pingRes}". Latency: ${Date.now() - start}ms`);
        }
        catch (err) {
            console.error(`[Redis] FAILED:`, err.message || err);
        }
    }
    else {
        console.log('[Redis] Not configured in env.');
    }
    // 2. Check Prisma Database
    console.log('\n[Prisma DB] Testing connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    const prisma = new client_1.PrismaClient({
        accelerateUrl: process.env.DATABASE_URL,
        log: ['error', 'warn'],
    });
    const startPrisma = Date.now();
    try {
        const res = await prisma.$queryRaw `SELECT 1`;
        console.log(`[Prisma DB] Success! Query result:`, JSON.stringify(res));
        console.log(`[Prisma DB] Latency for SELECT 1: ${Date.now() - startPrisma}ms`);
    }
    catch (err) {
        console.error(`[Prisma DB] FAILED:`, err.message || err);
    }
    // 3. Check PGVector
    console.log('\n[Prisma PGVector] Checking pgvector extension...');
    const startVector = Date.now();
    try {
        const res = await prisma.$queryRaw `SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
        console.log(`[Prisma PGVector] Success! Query result:`, JSON.stringify(res));
        console.log(`[Prisma PGVector] Latency: ${Date.now() - startVector}ms`);
    }
    catch (err) {
        console.error(`[Prisma PGVector] FAILED:`, err.message || err);
    }
    await prisma.$disconnect();
    console.log('\n--- Diagnostics Complete ---');
}
runDiagnostics().catch(console.error);
