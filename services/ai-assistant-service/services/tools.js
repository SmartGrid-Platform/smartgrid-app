const axios = require('axios');

const CONSUMER_URL = process.env.CONSUMER_SERVICE_URL || 'http://localhost:3002';
const METER_URL = process.env.METER_SERVICE_URL || 'http://localhost:3003';
const BILLING_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:3004';

const getHeaders = (config) => {
  if (config && config.authHeader) {
    return { Authorization: config.authHeader };
  }
  return {};
};

// Logging Helpers
const logRequest = (name, url, method, headers, params = null) => {
  console.log(`[TOOL-EXECUTION] [REQUEST] Tool: "${name}" | API Request: ${method.toUpperCase()} ${url}`);
  console.log(`[TOOL-EXECUTION] [REQUEST] Headers:`, JSON.stringify(headers));
  if (params) {
    console.log(`[TOOL-EXECUTION] [REQUEST] Params/Body:`, JSON.stringify(params));
  }
};

const logResponse = (name, status, data) => {
  const dataSnippet = typeof data === 'object' ? JSON.stringify(data).substring(0, 300) : String(data).substring(0, 300);
  console.log(`[TOOL-EXECUTION] [RESPONSE] Tool: "${name}" | API Response: ${status} | Payload Snippet: ${dataSnippet}...`);
};

const logError = (name, error) => {
  console.error(`[TOOL-EXECUTION] [ERROR] Tool: "${name}" | API Error:`, error.message);
  if (error.response) {
    console.error(`[TOOL-EXECUTION] [ERROR] Status: ${error.response.status} | Data:`, JSON.stringify(error.response.data));
  }
};

const searchWikipedia = async (query) => {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1`;
    console.log('[SEARCH] Querying Wikipedia:', url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'SmartGridUtilityAssistant/1.0 (admin@smartgrid.com)'
      },
      timeout: 5000
    });
    const searchResults = response?.data?.query?.search;
    if (!searchResults || searchResults.length === 0) {
      return "No search results found.";
    }
    
    const snippetList = [];
    for (let i = 0; i < Math.min(3, searchResults.length); i++) {
      const item = searchResults[i];
      const cleanSnippet = item.snippet.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      snippetList.push(`Title: [${item.title}](https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)})\nSnippet: ${cleanSnippet}`);
    }
    return snippetList.join('\n\n');
  } catch (error) {
    console.error('[SEARCH] Wikipedia failed:', error.message);
    return 'Web search failed: ' + error.message;
  }
};

const scrapeDuckDuckGo = async (query) => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log('[SEARCH] Querying DuckDuckGo:', url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 5000
    });
    const html = response.data;
    if (html.includes('anomaly-modal') || html.includes('captcha') || html.includes('bots use DuckDuckGo too')) {
      throw new Error('Bot challenge block detected');
    }
    
    const results = [];
    // Regex 1: Matches table-based result structure with link and snippet
    const tableRegex = /<a\s+class="result-link"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td\s+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    let match;
    while ((match = tableRegex.exec(html)) !== null && results.length < 5) {
      const link = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      results.push(`[${title}](${link}) - ${snippet}`);
    }

    // Regex 2: Try finding result__snippet
    if (results.length === 0) {
      const cellRegex = /<td class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
      while ((match = cellRegex.exec(html)) !== null && results.length < 5) {
        const text = match[1].replace(/<[^>]*>/g, '').trim();
        results.push(text);
      }
    }
    
    if (results.length === 0) {
      throw new Error('No matches found in HTML');
    }
    
    return results.join('\n\n');
  } catch (error) {
    console.warn(`[SEARCH] DuckDuckGo failed (${error.message}). Falling back to Wikipedia...`);
    return await searchWikipedia(query);
  }
};

const toolsList = [
  {
    toolSpec: {
      name: "consumer_tool",
      description: "Returns the consumer's profile information, consumer number, user name, connection status, balance, and connection address. Allows searching by consumerId or consumerNumber (useful for staff/admin).",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            consumerId: {
              type: "integer",
              description: "Optional consumer ID (primary key in Consumer table)."
            },
            consumerNumber: {
              type: "string",
              description: "Optional consumer number (e.g. CON-30284637)."
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "meter_tool",
      description: "Returns smart meter details (meter number, type, status, assigned tariff details) and the latest (current) and previous readings.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            consumerId: {
              type: "integer",
              description: "Optional consumer ID. If omitted, uses logged in user's consumer ID."
            },
            meterNumber: {
              type: "string",
              description: "Optional meter serial number."
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "billing_tool",
      description: "Returns current bill statement details, previous bills history, due amount, and payment status.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            consumerId: {
              type: "integer",
              description: "Optional consumer ID. If omitted, uses logged in user's consumer ID."
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "tariff_tool",
      description: "Returns the active tariff plan details (Tariff Name, Rate Per Unit/kWh, and Fixed Charge) assigned to the consumer's meter.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            consumerId: {
              type: "integer",
              description: "Optional consumer ID. If omitted, uses logged in user's consumer ID."
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "consumption_tool",
      description: "Returns consumption analysis (current units used from the latest reading, total monthly usage for the current calendar month, and monthly historical trends).",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            consumerId: {
              type: "integer",
              description: "Optional consumer ID. If omitted, uses logged in user's consumer ID."
            }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: "web_search",
      description: "Performs web search or queries regulatory knowledge base to answer general electricity, state tariffs (AP, TS, TN, KA), solar, net metering, slabs, and utility rules.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (e.g. 'Andhra Pradesh domestic tariff slabs' or 'solar rooftop net metering rules')"
            }
          },
          required: ["query"]
        }
      }
    }
  },
  // Keep original tools for backward compatibility
  {
    toolSpec: {
      name: "get_consumer_profile",
      description: "Fetches consumer profile information. Does not require arguments.",
      inputSchema: {
        json: {
          type: "object",
          properties: {}
        }
      }
    }
  },
  {
    toolSpec: {
      name: "get_consumer_bills",
      description: "Fetches the billing records for the consumer.",
      inputSchema: {
        json: {
          type: "object",
          properties: {}
        }
      }
    }
  },
  {
    toolSpec: {
      name: "get_consumer_recharges",
      description: "Fetches the consumer's recharge/payment history.",
      inputSchema: {
        json: {
          type: "object",
          properties: {}
        }
      }
    }
  },
  {
    toolSpec: {
      name: "get_consumer_meters_and_usage",
      description: "Fetches consumer smart meters and recent readings.",
      inputSchema: {
        json: {
          type: "object",
          properties: {}
        }
      }
    }
  },
  {
    toolSpec: {
      name: "get_active_tariff",
      description: "Fetches global electricity tariff rates.",
      inputSchema: {
        json: {
          type: "object",
          properties: {}
        }
      }
    }
  }
];

const LOCAL_KNOWLEDGE_BASE = {
  andhra_pradesh: `Andhra Pradesh Electricity Tariff Slabs (APSPDCL/APEPDCL):
- Domestic Slabs (Prepaid/Postpaid):
  * 0 - 50 units: ₹1.45 per unit
  * 51 - 100 units: ₹2.60 per unit
  * 101 - 200 units: ₹3.60 per unit
  * 201 - 300 units: ₹7.20 per unit
  * 301 - 400 units: ₹8.50 per unit
  * Above 400 units: ₹9.50 per unit
- Fixed Charge / Customer Charges: ₹25 to ₹75 depending on consumption range.
Source: Andhra Pradesh Electricity Regulatory Commission (APERC) standard domestic tariff schedule.`,

  telangana: `Telangana Electricity Tariff Slabs (TSSPDCL/TSNPDCL):
- Domestic Slabs:
  * 0 - 50 units: ₹1.45 per unit
  * 51 - 100 units: ₹2.60 per unit
  * 101 - 200 units: ₹4.30 per unit
  * 201 - 300 units: ₹7.20 per unit
  * 301 - 400 units: ₹8.50 per unit
  * 401 - 800 units: ₹9.00 per unit
  * Above 800 units: ₹10.00 per unit
- Customer Charges: ₹25 to ₹80 per month.
Source: Telangana State Electricity Regulatory Commission (TSERC) tariff order.`,

  tamil_nadu: `Tamil Nadu Electricity Tariff Slabs (TANGEDCO):
- Domestic Slabs (Bimonthly billing cycles):
  * 0 - 100 units: Free (100% Subsidy)
  * 101 - 200 units: ₹4.50 per unit
  * 201 - 500 units: ₹6.00 per unit (for 201-400 range) and ₹8.00 per unit (for 401-500 range)
  * Above 500 units: ₹9.00 to ₹11.00 per unit depending on consumption slabs.
- Fixed Charges: Fixed charges are merged into energy rates for domestic category.
Source: Tamil Nadu Electricity Regulatory Commission (TNERC) tariff revision schedule.`,

  karnataka: `Karnataka Electricity Tariff Slabs (BESCOM/HESCOM/GESCOM):
- Domestic Slabs (Prepaid/Postpaid):
  * Lifeline / Low Income (0 - 40 units): ₹4.15 per unit
  * General Domestic (0 - 100 units): ₹5.90 per unit
  * General Domestic (Above 100 units): ₹7.30 to ₹8.05 per unit
- Fixed Charges / Fixed Monthly Fees: ₹100 to ₹250 depending on sanctioned load (kW).
Source: Karnataka Electricity Regulatory Commission (KERC) tariff schedule.`,

  solar: `Solar Rooftop Tariffs & Net Metering Rules in India:
- Net Metering: Consumers get credits on their monthly bills for excess power exported from rooftop solar panels to the grid.
- Gross Metering: All solar power generated is exported to grid at a feed-in tariff, and consumer pays normal tariff for consumption.
- Net Feed-in Tariff: Excess exported units are credited/paid at ₹3.00 to ₹4.50 per unit (varying by state DISCOM guidelines, e.g. TSSPDCL or BESCOM).
Source: State Solar Rooftop Policies & Regulatory Guidelines.`,

  net_metering: `Net Metering Regulations:
- Applicability: Available for residential customers with rooftop solar systems (usually up to 100% or 150% of sanctioned load).
- Billing: Credits are carried forward to the next billing cycle. At the end of the financial year, any remaining excess credits are settled by the DISCOM at the average power purchase cost (APPC), typically around ₹3.00 to ₹4.20 per unit.
Source: State Electricity Regulatory Commissions (SERCs).`
};

const executeTool = async (name, args, config) => {
  const headers = getHeaders(config);
  const { consumerId } = config;
  
  console.log(`[AGENT-TOOLS] Executing tool "${name}" for consumer ID "${consumerId}"`);
  
  switch (name) {
    // 1. CONSUMER TOOL
    case 'consumer_tool':
    case 'get_consumer_profile': {
      const { consumerId: lookupId, consumerNumber } = args || {};
      let url = `${CONSUMER_URL}/api/consumers/me`;
      
      if (lookupId) {
        url = `${CONSUMER_URL}/api/consumers/${lookupId}`;
      } else if (consumerNumber) {
        url = `${CONSUMER_URL}/api/consumers`;
      }
      
      logRequest(name, url, 'GET', headers);
      try {
        const res = await axios.get(url, { headers });
        logResponse(name, res.status, res.data);
        
        if (consumerNumber && !lookupId) {
          const consumers = Array.isArray(res.data) ? res.data : [];
          const found = consumers.find(c => c.consumer_number === consumerNumber);
          if (!found) {
            return `Error: Consumer profile with number "${consumerNumber}" not found in database.`;
          }
          return JSON.stringify({
            consumerProfile: {
              id: found.id,
              consumer_number: found.consumer_number,
              address: found.address,
              phone: found.phone,
              connection_status: found.connection_status,
              balance: found.balance
            },
            userName: found.user?.name,
            email: found.user?.email,
            role: 'CONSUMER'
          });
        }
        
        const data = res.data;
        return JSON.stringify({
          consumerProfile: {
            id: data.id,
            consumer_number: data.consumer_number,
            address: data.address,
            phone: data.phone,
            connection_status: data.connection_status,
            balance: data.balance
          },
          userName: data.user?.name,
          email: data.user?.email,
          role: 'CONSUMER'
        });
      } catch (error) {
        logError(name, error);
        if (url.endsWith('/me') && error.response?.status === 403) {
          // Fallback for staff/admin users who don't have consumer profiles
          const fallbackUrl = `${CONSUMER_URL}/api/consumers`;
          logRequest(name, fallbackUrl, 'GET', headers);
          try {
            const fbRes = await axios.get(fallbackUrl, { headers });
            logResponse(name, fbRes.status, fbRes.data);
            return JSON.stringify({
              message: "Authenticated as Staff/Admin. Listing all consumer profiles.",
              consumers: fbRes.data
            });
          } catch (fbErr) {
            logError(name, fbErr);
            return `Error: Failed to fetch consumer list. Code: ${fbErr.response?.status || 'Unknown'}. Message: ${fbErr.response?.data?.error || fbErr.message}`;
          }
        }
        return `Error: Failed to retrieve consumer profile. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }
    }

    // 2. METER TOOL
    case 'meter_tool':
    case 'get_consumer_meters_and_usage': {
      const { consumerId: lookupId, meterNumber } = args || {};
      const cId = lookupId || consumerId;
      
      if (!cId && !meterNumber) {
        return "Error: Missing consumer ID or meter number for lookup. If you are logged in as a consumer, your ID should be automatically loaded, otherwise provide one as an input.";
      }

      let meters = [];
      try {
        if (meterNumber) {
          const url = `${METER_URL}/api/meters`;
          logRequest(name, url, 'GET', headers);
          const res = await axios.get(url, { headers });
          logResponse(name, res.status, res.data);
          meters = (Array.isArray(res.data) ? res.data : []).filter(m => m.meter_number === meterNumber);
        } else {
          const url = `${METER_URL}/api/meters/consumer/${cId}`;
          logRequest(name, url, 'GET', headers);
          const res = await axios.get(url, { headers });
          logResponse(name, res.status, res.data);
          meters = Array.isArray(res.data) ? res.data : (res.data?.meters || []);
        }
      } catch (error) {
        logError(name, error);
        return `Error: Failed to fetch meters. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }

      if (meters.length === 0) {
        return `No smart meters assigned to consumer ID "${cId}" or matching serial number "${meterNumber}".`;
      }

      const results = [];
      for (const meter of meters) {
        const readingsUrl = `${METER_URL}/api/meters/${meter.id}/readings`;
        logRequest(name, readingsUrl, 'GET', headers);
        try {
          const readingsRes = await axios.get(readingsUrl, { headers });
          logResponse(name, readingsRes.status, readingsRes.data);
          const readings = Array.isArray(readingsRes.data) ? readingsRes.data : (readingsRes.data?.readings || []);
          
          const sorted = [...readings].sort((a, b) => new Date(b.reading_date || b.created_at) - new Date(a.reading_date || a.created_at));
          const currentReading = sorted[0] ? { value: parseFloat(sorted[0].units_consumed), date: sorted[0].reading_date || sorted[0].created_at } : null;
          const previousReading = sorted[1] ? { value: parseFloat(sorted[1].units_consumed), date: sorted[1].reading_date || sorted[1].created_at } : null;
          
          results.push({
            meterNumber: meter.meter_number,
            meterType: meter.meter_type || 'SMART',
            status: meter.status,
            currentReading,
            previousReading,
            tariff: meter.tariff ? {
              tariffName: meter.tariff.tariff_name,
              ratePerUnit: parseFloat(meter.tariff.rate_per_unit),
              fixedCharge: parseFloat(meter.tariff.fixed_charge || 0)
            } : null
          });
        } catch (error) {
          logError(name, error);
          results.push({
            meterNumber: meter.meter_number,
            meterType: meter.meter_type || 'SMART',
            status: meter.status,
            error: `Failed to fetch readings: ${error.message}`
          });
        }
      }
      return JSON.stringify(results);
    }

    // 3. BILLING TOOL
    case 'billing_tool':
    case 'get_consumer_bills': {
      const { consumerId: lookupId } = args || {};
      const cId = lookupId || consumerId;
      
      if (!cId) {
        return "Error: Missing consumer ID for billing lookup. Provide a consumerId parameter.";
      }

      // Fetch balance details first
      let balance = 0.00;
      let connectionStatus = 'UNKNOWN';
      try {
        const pUrl = `${CONSUMER_URL}/api/consumers/${cId}`;
        logRequest(name, pUrl, 'GET', headers);
        const pRes = await axios.get(pUrl, { headers });
        logResponse(name, pRes.status, pRes.data);
        balance = parseFloat(pRes.data.balance || 0);
        connectionStatus = pRes.data.connection_status;
      } catch (err) {
        logError(name, err);
      }

      const url = `${BILLING_URL}/api/bills/consumer/${cId}`;
      logRequest(name, url, 'GET', headers);
      try {
        const res = await axios.get(url, { headers });
        logResponse(name, res.status, res.data);
        const bills = Array.isArray(res.data) ? res.data : [];
        const sorted = [...bills].sort((a, b) => new Date(b.generated_at || b.created_at) - new Date(a.generated_at || a.created_at));
        
        const currentBill = sorted[0] || null;
        const previousBills = sorted.slice(1);
        const dueAmount = balance < 0 ? Math.abs(balance) : 0.00;

        return JSON.stringify({
          balance,
          connectionStatus,
          dueAmount,
          currentBill: currentBill ? {
            id: currentBill.id,
            billingMonth: currentBill.billing_month,
            unitsUsed: parseFloat(currentBill.units_used),
            amount: parseFloat(currentBill.amount),
            status: currentBill.status,
            pdfPath: currentBill.pdf_path,
            generatedAt: currentBill.generated_at || currentBill.created_at
          } : null,
          paymentStatus: currentBill ? currentBill.status : 'N/A',
          previousBills: previousBills.map(b => ({
            id: b.id,
            billingMonth: b.billing_month,
            unitsUsed: parseFloat(b.units_used),
            amount: parseFloat(b.amount),
            status: b.status,
            generatedAt: b.generated_at || b.created_at
          }))
        });
      } catch (error) {
        logError(name, error);
        return `Error: Failed to fetch billing statements. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }
    }

    // 4. TARIFF TOOL
    case 'tariff_tool':
    case 'get_active_tariff': {
      const { consumerId: lookupId } = args || {};
      const cId = lookupId || consumerId;

      if (cId) {
        // Fetch consumer's meter to check its linked tariff
        const url = `${METER_URL}/api/meters/consumer/${cId}`;
        logRequest(name, url, 'GET', headers);
        try {
          const res = await axios.get(url, { headers });
          logResponse(name, res.status, res.data);
          const meters = Array.isArray(res.data) ? res.data : (res.data?.meters || []);
          const meterWithTariff = meters.find(m => m.tariff);
          if (meterWithTariff && meterWithTariff.tariff) {
            return JSON.stringify({
              tariffName: meterWithTariff.tariff.tariff_name,
              ratePerUnit: parseFloat(meterWithTariff.tariff.rate_per_unit),
              fixedCharge: parseFloat(meterWithTariff.tariff.fixed_charge || 0),
              description: meterWithTariff.tariff.description,
              effectiveDate: meterWithTariff.tariff.effective_date,
              source: "Assigned Meter Tariff Plan"
            });
          }
        } catch (error) {
          logError(name, error);
        }
      }

      // Fetch global tariff list
      const url = `${BILLING_URL}/api/tariffs`;
      logRequest(name, url, 'GET', headers);
      try {
        const res = await axios.get(url, { headers });
        logResponse(name, res.status, res.data);
        return JSON.stringify({
          tariffs: res.data,
          source: "Global Tariff Configuration Slabs"
        });
      } catch (error) {
        logError(name, error);
        return `Error: Failed to retrieve tariff slabs. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }
    }

    // 5. CONSUMPTION TOOL
    case 'consumption_tool': {
      const { consumerId: lookupId } = args || {};
      const cId = lookupId || consumerId;

      if (!cId) {
        return "Error: Missing consumer ID for consumption calculation. Provide a consumerId parameter.";
      }

      const metersUrl = `${METER_URL}/api/meters/consumer/${cId}`;
      logRequest(name, metersUrl, 'GET', headers);
      let meters = [];
      try {
        const res = await axios.get(metersUrl, { headers });
        logResponse(name, res.status, res.data);
        meters = Array.isArray(res.data) ? res.data : (res.data?.meters || []);
      } catch (error) {
        logError(name, error);
        return `Error: Failed to fetch consumer meters. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }

      if (meters.length === 0) {
        return `No smart meters assigned to consumer ID "${cId}". Cannot compute consumption.`;
      }

      const analysis = [];
      for (const meter of meters) {
        const readingsUrl = `${METER_URL}/api/meters/${meter.id}/readings`;
        logRequest(name, readingsUrl, 'GET', headers);
        try {
          const readingsRes = await axios.get(readingsUrl, { headers });
          logResponse(name, readingsRes.status, readingsRes.data);
          const readings = Array.isArray(readingsRes.data) ? readingsRes.data : (readingsRes.data?.readings || []);
          
          const sorted = [...readings].sort((a, b) => new Date(a.reading_date || a.created_at) - new Date(b.reading_date || b.created_at)); // chronological
          
          const latestReading = sorted[sorted.length - 1];
          const currentUsage = latestReading ? parseFloat(latestReading.units_consumed) : 0.00;
          
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth(); // 0-indexed
          
          const monthlyReadings = sorted.filter(r => {
            const d = new Date(r.reading_date || r.created_at);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
          });
          const monthlyUsage = monthlyReadings.reduce((sum, r) => sum + parseFloat(r.units_consumed), 0);
          
          // Historical trends grouped by YYYY-MM
          const monthlyGroups = {};
          sorted.forEach(r => {
            const d = new Date(r.reading_date || r.created_at);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyGroups[monthStr] = (monthlyGroups[monthStr] || 0) + parseFloat(r.units_consumed);
          });
          
          const historicalTrends = Object.entries(monthlyGroups).map(([month, units]) => ({
            month,
            units_consumed: units
          })).sort((a, b) => b.month.localeCompare(a.month)); // Newest month first
          
          analysis.push({
            meterNumber: meter.meter_number,
            meterType: meter.meter_type || 'SMART',
            currentUsage: {
              units: currentUsage,
              date: latestReading ? (latestReading.reading_date || latestReading.created_at) : null
            },
            monthlyUsageThisMonth: monthlyUsage,
            historicalTrends
          });
        } catch (error) {
          logError(name, error);
          analysis.push({
            meterNumber: meter.meter_number,
            meterType: meter.meter_type || 'SMART',
            error: `Failed to fetch readings for consumption analysis: ${error.message}`
          });
        }
      }
      return JSON.stringify(analysis);
    }

    // 6. RECHARGES TOOL (original)
    case 'get_consumer_recharges': {
      if (!consumerId) return "Error: Missing consumer ID in context";
      const url = `${BILLING_URL}/api/recharges/consumer/${consumerId}`;
      logRequest(name, url, 'GET', headers);
      try {
        const res = await axios.get(url, { headers });
        logResponse(name, res.status, res.data);
        return JSON.stringify(res.data);
      } catch (error) {
        logError(name, error);
        return `Error: Failed to fetch recharges. Code: ${error.response?.status || 'Unknown'}. Message: ${error.response?.data?.error || error.message}`;
      }
    }

    // 7. WEB SEARCH TOOL
    case 'web_search': {
      const q = args.query.toLowerCase();
      let localInfo = "";
      if (q.includes("andhra")) localInfo += LOCAL_KNOWLEDGE_BASE.andhra_pradesh + "\n\n";
      if (q.includes("telangana")) localInfo += LOCAL_KNOWLEDGE_BASE.telangana + "\n\n";
      if (q.includes("tamil nadu") || q.includes("tamilnadu") || q.includes("chennai")) localInfo += LOCAL_KNOWLEDGE_BASE.tamil_nadu + "\n\n";
      if (q.includes("karnataka") || q.includes("bangalore") || q.includes("bengaluru")) localInfo += LOCAL_KNOWLEDGE_BASE.karnataka + "\n\n";
      if (q.includes("solar")) localInfo += LOCAL_KNOWLEDGE_BASE.solar + "\n\n";
      if (q.includes("net metering") || q.includes("net-metering")) localInfo += LOCAL_KNOWLEDGE_BASE.net_metering + "\n\n";
      
      const searchResult = await scrapeDuckDuckGo(args.query);
      return (localInfo + searchResult).trim() || "No detailed search results found.";
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

module.exports = {
  toolsList,
  executeTool
};
