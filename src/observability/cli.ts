#!/usr/bin/env node

import { startDashboard } from "./server"

const port = process.env.AGENT_DASHBOARD_PORT ? parseInt(process.env.AGENT_DASHBOARD_PORT) : 4500

startDashboard({ port })
