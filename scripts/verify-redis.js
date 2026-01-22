const Redis = require('ioredis');
require('dotenv').config();

async function verify() {
    console.log('🔍 Verifying Redis Configuration...');

    // Check environment variables directly
    const upstashUrl = process.env.UPSTASH_REDIS_URL;
    const redisUrl = process.env.REDIS_URL;

    console.log(`\nEnvironment Variables:`);
    console.log(`UPSTASH_REDIS_URL: ${upstashUrl ? '✅ Set' : '❌ Not Set'}`);
    console.log(`REDIS_URL: ${redisUrl ? '✅ Set ' + maskUrl(redisUrl) : '❌ Not Set'}`);

    const targetUrl = upstashUrl || redisUrl;

    if (!targetUrl) {
        console.error('\n❌ No Redis URL configured!');
        process.exit(1);
    }

    console.log(`\nAttempting connection to: ${maskUrl(targetUrl)}`);

    const redis = new Redis(targetUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry endlessly for this test
    });

    try {
        await redis.connectPromise; // Wait for connection if utilizing lazy connect, though ioredis auto-connects
        // Explicitly ping
        const result = await redis.ping();
        console.log(`\n✅ Validated Connection! PING response: ${result}`);

        // Write a test key
        const testKey = 'keyvault:verify:' + Date.now();
        await redis.set(testKey, 'verified', 'EX', 60);
        console.log(`✅ Write Test Passed (Key: ${testKey})`);

        const value = await redis.get(testKey);
        console.log(`✅ Read Test Passed (Value: ${value})`);

    } catch (error) {
        console.error('\n❌ Connection Failed:');
        console.error(error.message);
    } finally {
        redis.disconnect();
    }
}

function maskUrl(url) {
    if (!url) return 'null';
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.username}:****@${u.hostname}:${u.port}`;
    } catch (e) {
        return 'Invalid URL Format';
    }
}

verify();
