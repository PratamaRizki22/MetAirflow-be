module.exports = {
    apps: [
        {
            name: 'rentverse-api',
            script: './src/server.js',

            // Single instance for 1 CPU (no clustering)
            instances: 1,
            exec_mode: 'fork',

            // Memory management for 2GB RAM environment
            max_memory_restart: '1500M', // Restart if memory exceeds 1.5GB

            // Environment variables
            env: {
                NODE_ENV: 'production',
                NODE_OPTIONS: '--max-old-space-size=1536', // Limit Node.js heap to 1.5GB
                PORT: 3000,
            },

            env_development: {
                NODE_ENV: 'development',
                NODE_OPTIONS: '--max-old-space-size=1024',
                PORT: 3000,
            },

            // Logging
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Auto-restart configuration
            autorestart: true,
            watch: false, // Disable watch in production
            max_restarts: 10, // Max 10 restarts in min_uptime window
            min_uptime: '10s', // Minimum uptime before considering stable
            restart_delay: 4000, // Wait 4s before restart

            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 3000,
            shutdown_with_message: true,

            // Advanced features
            exp_backoff_restart_delay: 100, // Exponential backoff on restart

            // Monitoring
            instance_var: 'INSTANCE_ID',

            // Source map support (optional, adds ~50MB memory)
            source_map_support: false,

            // Disable metrics to save memory
            disable_logs: false,

            // Cron restart (optional - restart daily at 3 AM to clear memory)
            cron_restart: '0 3 * * *',

            // Additional environment-specific settings
            node_args: [
                '--max-old-space-size=1536',
                '--optimize-for-size',
                '--gc-interval=100',
            ],
        },
    ],

    // Deployment configuration (optional)
    deploy: {
        production: {
            user: 'deploy',
            host: 'your-server.com',
            ref: 'origin/main',
            repo: 'git@github.com:username/rentverse-core-service.git',
            path: '/var/www/rentverse-api',
            'post-deploy': 'npm install && npx prisma generate && npx prisma migrate deploy && pm2 reload ecosystem.config.js --env production',
            'pre-deploy-local': 'echo "Deploying to production..."',
        },
    },
};
