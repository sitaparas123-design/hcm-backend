const getAiServerUrl = () => process.env.AI_SERVER_URL || 'http://localhost:4000';

// POST /api/employee/ai/resume-builder
const aiBuildResume = async (req, res, next) => {
  try {
    const { details } = req.body;
    const response = await fetch(`${getAiServerUrl()}/api/mcp/resume/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ details })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/employee/ai/policy-assistant
const aiPolicyAssistant = async (req, res, next) => {
  try {
    const { query } = req.body;
    const tenantId = req.user.organizationId || 'global';
    const accessLevel = req.user.role || 'EMPLOYEE';
    const response = await fetch(`${getAiServerUrl()}/api/mcp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: query }],
        tenantId,
        accessLevel
      })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// GET /api/manager/ai/attendance-insights
const aiAttendanceInsights = async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const attendance = await prisma.attendanceLog.findMany({ take: 50 });
    
    const response = await fetch(`${getAiServerUrl()}/api/mcp/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Attendance Insights & Patterns',
        data: { attendance }
      })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/employee/ai/payroll-insights
const aiPayrollInsights = async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 1. Identify employee from req.user.userId (JWT context — never trust frontend)
    const employee = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.userId },
      include: {
        compensationProfile: true  // 1-to-1 relation (not an array)
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    // 2. Fetch the latest payroll snapshots for this employee
    const snapshots = await prisma.payrollSnapshot.findMany({
      where: { employeeId: employee.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    const activeCompensation = employee.compensationProfile || null;

    // 3. Forward to AI Server payroll-insights
    const response = await fetch(`${getAiServerUrl()}/api/mcp/payroll/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: employee.employeeId || employee.id,
        payslipData: {
          employeeName: employee.fullName,
          activeCompensation: activeCompensation ? {
            monthlyCTC: activeCompensation.monthlyCTC,
            annualCTC: activeCompensation.annualCTC,
            currency: activeCompensation.currency
          } : null,
          history: snapshots.map(s => ({
            month: s.month,
            grossSalary: s.grossSalary,
            totalDeductions: s.totalDeductions,
            netSalary: s.netSalary,
            status: s.status,
            items: s.items.map(item => ({ label: item.name, amount: item.amount, type: item.type }))
          }))
        }
      })
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};


// POST /api/manager/ai/leave-recommendations
const aiLeaveRecommendations = async (req, res, next) => {
  try {
    const { employeeId, leaveHistory } = req.body;
    const response = await fetch(`${getAiServerUrl()}/api/mcp/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `Leave Balance & Recommendation for Employee ${employeeId}`,
        data: leaveHistory || {}
      })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/manager/ai/performance-summaries
const aiPerformanceSummaries = async (req, res, next) => {
  try {
    const { kpis, feedback } = req.body;
    const response = await fetch(`${getAiServerUrl()}/api/mcp/performance/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kpis, feedback })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/employee/ai/document-analyze
const aiDocumentAnalyze = async (req, res, next) => {
  try {
    const { documentId, documentText } = req.body;
    const response = await fetch(`${getAiServerUrl()}/api/mcp/document/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentText, context: `Document ID: ${documentId}` })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/superadmin/ai/analytics
const aiAnalytics = async (req, res, next) => {
  try {
    const { query } = req.body;
    const response = await fetch(`${getAiServerUrl()}/api/mcp/analytics/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, schemaContext: 'Enterprise database context queries' })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

// POST /api/employee/ai/generate-letter
const aiGenerateLetter = async (req, res, next) => {
  try {
    const { letterType, contextData } = req.body;
    
    const tenantId = req.user.organizationId;
    let companyName = 'GlobalTech.ai';
    let companyAddress = '100 AI Blvd, Suite 400, Tech City, TC 10101';
    let companyPhone = 'N/A';
    let companyEmail = 'N/A';
    
    if (tenantId) {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const org = await prisma.organization.findUnique({ where: { id: tenantId } });
      if (org) {
        companyName = org.name;
        companyAddress = org.address || companyAddress;
        companyPhone = org.supportPhone || companyPhone;
        companyEmail = org.primaryEmail || companyEmail;
      }
    }
    
    const enrichedContext = {
      ...contextData,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };

    const response = await fetch(`${getAiServerUrl()}/api/mcp/letter/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letterType, contextData: enrichedContext })
    });
    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (err) { next(err); }
};

module.exports = {
  aiBuildResume,
  aiPolicyAssistant,
  aiAttendanceInsights,
  aiPayrollInsights,
  aiLeaveRecommendations,
  aiPerformanceSummaries,
  aiDocumentAnalyze,
  aiAnalytics,
  aiGenerateLetter
};
