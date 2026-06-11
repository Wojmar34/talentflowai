import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, User, Sparkles, CheckCircle, ArrowRight, BookOpen, 
  Send, RefreshCw, FileText, Check, Award, MapPin, Layers, 
  TrendingUp, MessageSquare, Clipboard, Users, ShieldAlert, 
  HelpCircle, Settings, ChevronRight, Star, HeartHandshake, PhoneCall
} from 'lucide-react';

// Setup default empty API key. The preview environment injects the valid key automatically.
const apiKey = "";

export default function App() {
  // Navigation & View States
  // Views: 'landing' | 'candidate' | 'business'
  const [view, setView] = useState('landing');
  // Sub-tabs for Candidate: 'cv-optimizer' | 'job-matcher' | 'interview-prep' | 'pro-services'
  const [candidateTab, setCandidateTab] = useState('cv-optimizer');
  // Sub-tabs for Business: 'jd-generator' | 'candidate-screener' | 'blueprint' | 'pro-services'
  const [businessTab, setBusinessTab] = useState('jd-generator');
  
  // Custom API key configuration (optional developer override)
  const [customKey, setCustomKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // -------------------------
  // CANDIDATE APP STATES
  // -------------------------
  // CV Optimizer
  const [cvInput, setCvInput] = useState('');
  const [cvTargetRole, setCvTargetRole] = useState('');
  const [cvFeedback, setCvFeedback] = useState(null);

  // Job Matcher
  const [competencies, setCompetencies] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid');
  const [preferredIndustry, setPreferredIndustry] = useState('Technology');
  const [matcherResult, setMatcherResult] = useState(null);

  // Interview Prep (Simulator)
  const [interviewRole, setInterviewRole] = useState('');
  const [interviewType, setInterviewType] = useState('behavioral'); // 'behavioral' | 'technical' | 'competency'
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewHistory, setInterviewHistory] = useState([]); // [{role: 'interviewer'|'candidate', text: '', score: null, feedback: ''}]
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [interviewStats, setInterviewStats] = useState({ scoreSum: 0, turns: 0 });
  const [lastFeedback, setLastFeedback] = useState('');

  // -------------------------
  // BUSINESS APP STATES
  // -------------------------
  // Job Description Generator
  const [jdTitle, setJdTitle] = useState('');
  const [jdDept, setJdDept] = useState('');
  const [jdSeniority, setJdSeniority] = useState('Mid-Level');
  const [jdSkills, setJdSkills] = useState('');
  const [jdCulture, setJdCulture] = useState('');
  const [jdResult, setJdResult] = useState(null);

  // Candidate Screener
  const [screenerJD, setScreenerJD] = useState('');
  const [screenerResume, setScreenerResume] = useState('');
  const [screenerResult, setScreenerResult] = useState(null);

  // Interview Blueprint Creator
  const [blueprintRole, setBlueprintRole] = useState('');
  const [blueprintFocus, setBlueprintFocus] = useState('');
  const [blueprintResult, setBlueprintResult] = useState(null);

  // Marketplace Modal States
  const [bookingModal, setBookingModal] = useState(null); // service object or null
  const [bookingName, setBookingName] = useState('');
  const [bookingEmail, setBookingEmail] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [interviewHistory, currentQuestion]);

  // Clean JSON string returned by LLMs (removes Markdown code fences ```json ... ```)
  const sanitizeJsonString = (rawText) => {
    let cleanText = rawText.trim();
    // Strip leading markdown json tags
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    // Strip trailing code fences
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return cleanText.trim();
  };

  // Reusable Gemini API Request Client (with 5x exponential backoff retry logic)
  const callGeminiAPI = async (systemPrompt, userPrompt, jsonOutput = false) => {
    setLoading(true);
    setApiError('');
    const activeKey = customKey.trim() || apiKey;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${activeKey}`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    if (jsonOutput) {
      payload.generationConfig = {
        responseMimeType: "application/json"
      };
    }

    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          throw new Error("Received empty content from AI core.");
        }

        setLoading(false);
        if (jsonOutput) {
          const cleanJson = sanitizeJsonString(text);
          return JSON.parse(cleanJson);
        }
        return text;
      } catch (error) {
        if (i === 4) {
          setLoading(false);
          setApiError(`Service is currently busy. Error details: ${error.message}. Please verify your network connection.`);
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  // ----------------------------------------
  // CANDIDATE ACTIONS & LOGIC
  // ----------------------------------------
  const handleOptimizeCV = async () => {
    if (!cvInput.trim()) return;
    const systemPrompt = `You are an elite corporate Recruiter and resume designer.
Analyze the provided resume details or accomplishments and the target role if given.
Create a structured feedback response in JSON. Do not include any text outside of the JSON object.
Return matching exactly this JSON schema structure:
{
  "overallScore": 85,
  "strengths": ["Clear technical achievements", "Action-oriented language"],
  "gaps": ["Missing quantified business metrics", "Weak summary hook"],
  "optimizationSuggestions": ["Add metric details to job 1", "Clarify team size managed"],
  "revisedBullets": ["Spearheaded development of 3 low-latency microservices, reducing payload delays by 32%"]
}`;

    const userPrompt = `Target Role: ${cvTargetRole || 'Not specified'}\n\nResume Details:\n${cvInput}`;

    try {
      const parsedData = await callGeminiAPI(systemPrompt, userPrompt, true);
      setCvFeedback(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleMatchJobs = async () => {
    if (!competencies.trim()) return;
    const systemPrompt = `You are a professional talent acquisition matching engine.
Assess the competencies, current level of expertise, and preferred domain of the user.
Match them to realistic high-demand job profiles. Return matching exactly this JSON schema structure:
{
  "fitScore": 90,
  "matchedRoles": [
    {
      "title": "Senior Solutions Engineer",
      "level": "Senior",
      "suitabilityReason": "Strong alignment with backend architecture skills and client solution delivery.",
      "salaryRangeEstimate": "$130,000 - $160,000 USD",
      "topGaps": ["System design certification", "Kubernetes experience"]
    }
  ],
  "skillsEnhancementAdvice": "Focus on obtaining cloud native containerization certificates to qualify for high-tier compensation brackets."
}`;

    const userPrompt = `Competence Scope/Skills: ${competencies}\nTarget Experience Level: ${experienceLevel}\nPreferred Industry: ${preferredIndustry}`;

    try {
      const parsedData = await callGeminiAPI(systemPrompt, userPrompt, true);
      setMatcherResult(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleStartInterview = async () => {
    if (!interviewRole.trim()) return;
    setInterviewStarted(true);
    setInterviewHistory([]);
    setInterviewStats({ scoreSum: 0, turns: 0 });
    setLastFeedback('');

    const systemPrompt = `You are an expert HR recruiter conducting a mock interview for a Candidate.
Prepare an initial interview question based on the role and interview type.
Output the response in the following JSON format:
{
  "feedbackOnLastAnswer": "Welcome greeting and initial instruction context.",
  "scoreForLastAnswer": 100,
  "nextQuestion": "Let's start. Can you tell me about a time you resolved a major deadlock in a team project?",
  "competencyTested": "Conflict resolution / Technical problem-solving"
}`;

    const userPrompt = `Start a new ${interviewType} mock interview for the role of: "${interviewRole}". Introduce yourself and ask the first question.`;

    try {
      const initialTurn = await callGeminiAPI(systemPrompt, userPrompt, true);
      setCurrentQuestion(initialTurn.nextQuestion);
      setInterviewHistory([
        { role: 'interviewer', text: initialTurn.nextQuestion, competency: initialTurn.competencyTested }
      ]);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!userAnswer.trim()) return;

    const systemPrompt = `You are a veteran Talent Scout conducting a deep mock interview for the role: "${interviewRole}".
Review the candidate's response to your previous question and grade it constructly.
Output exactly this JSON schema structure:
{
  "feedbackOnLastAnswer": "Excellent use of the STAR framework. You highlighted action steps well, but lacked a quantified result metric.",
  "scoreForLastAnswer": 85,
  "nextQuestion": "How do you prioritize deliverables when managing conflicting stakeholder timelines?",
  "competencyTested": "Stakeholder management & Prioritization"
}`;

    // Append user message to history instantly
    const userMsg = { role: 'candidate', text: userAnswer };
    const historicalContext = [...interviewHistory, userMsg]
      .map(h => `${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${h.text}`)
      .join('\n\n');

    setInterviewHistory(prev => [...prev, userMsg]);
    setUserAnswer('');

    try {
      const result = await callGeminiAPI(systemPrompt, historicalContext, true);
      
      setLastFeedback(result.feedbackOnLastAnswer);
      setInterviewStats(prev => ({
        scoreSum: prev.scoreSum + result.scoreForLastAnswer,
        turns: prev.turns + 1
      }));

      setInterviewHistory(prev => [
        ...prev,
        { 
          role: 'interviewer', 
          text: result.nextQuestion, 
          competency: result.competencyTested,
          feedback: result.feedbackOnLastAnswer,
          score: result.scoreForLastAnswer
        }
      ]);
      setCurrentQuestion(result.nextQuestion);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  // ----------------------------------------
  // BUSINESS ACTIONS & LOGIC
  // ----------------------------------------
  const handleGenerateJD = async () => {
    if (!jdTitle.trim() || !jdSkills.trim()) return;
    const systemPrompt = `You are an elite corporate Talent Acquisition Specialist.
Draft a high-impact, modern, inclusive, and professional Job Description (JD).
Output strictly as JSON based on the schema:
{
  "title": "Software Engineer",
  "department": "Engineering",
  "overview": "Dynamic overview highlighting company mission and role scale.",
  "responsibilities": ["Collaborate on feature designs", "Maintain system architecture"],
  "requirements": ["3+ years JavaScript", "Experience with Node.js"],
  "preferredQualifications": ["AWS Architecture certification"],
  "benefits": ["Unlimited PTO", "Health wellness stipends"],
  "compensationRange": "$110,000 - $140,000 USD"
}`;

    const userPrompt = `Role: ${jdTitle}\nDepartment: ${jdDept}\nSeniority: ${jdSeniority}\nKey Skills: ${jdSkills}\nCulture/Values: ${jdCulture || 'Standard high-performing team'}`;

    try {
      const parsedData = await callGeminiAPI(systemPrompt, userPrompt, true);
      setJdResult(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleScreenCandidate = async () => {
    if (!screenerJD.trim() || !screenerResume.trim()) return;
    const systemPrompt = `You are an advanced recruitment intelligence system screening candidates.
Analyze the target job description and the candidate's resume. Compare key skills, seniority, and milestones.
Output exactly this JSON format:
{
  "suitabilityScore": 82,
  "skillsMatched": ["React", "CSS", "Git"],
  "skillsMissing": ["Docker", "GraphQL"],
  "strengths": ["Extensive frontend design layout experience", "Solid employment tenure"],
  "concerns": ["Limited backend framework exposure"],
  "customInterviewQuestions": ["Can you talk about your experience interacting with SQL or NoSQL database servers?"]
}`;

    const userPrompt = `Target Job Description:\n${screenerJD}\n\nCandidate Resume/Profile:\n${screenerResume}`;

    try {
      const parsedData = await callGeminiAPI(systemPrompt, userPrompt, true);
      setScreenerResult(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  const handleCreateBlueprint = async () => {
    if (!blueprintRole.trim()) return;
    const systemPrompt = `You are a senior human resource architect.
Develop a rigorous Interview Blueprint mapped to key organizational focus areas.
Output strictly in this JSON format:
{
  "focusAreas": [
    {
      "competency": "Adaptive Communication",
      "importance": "High - Required for cross-departmental alignment",
      "questions": ["Describe a time you explained a complex concept to a non-technical stakeholder."],
      "whatToLookFor": "Look for structure, active listening indicators, and clear simple language setups."
    }
  ]
}`;

    const userPrompt = `Job Title/Focus: ${blueprintRole}\nSpecific Competencies of Focus: ${blueprintFocus || 'General leadership, problem-solving'}`;

    try {
      const parsedData = await callGeminiAPI(systemPrompt, userPrompt, true);
      setBlueprintResult(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON", e);
    }
  };

  // ----------------------------------------
  // BOOKING MODALS & AUXILIARY
  // ----------------------------------------
  const handleOpenBooking = (serviceName) => {
    setBookingModal(serviceName);
    setBookingSuccess(false);
  };

  const handleBookSubmit = (e) => {
    e.preventDefault();
    setBookingSuccess(true);
    setTimeout(() => {
      setBookingModal(null);
      setBookingName('');
      setBookingEmail('');
      setBookingSuccess(false);
    }, 2500);
  };

  const handleClipboardCopy = (text) => {
    if (!text) return;
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
  };

  // Human Professional Services Packages
  const candidateServices = [
    { title: "Elite CV Executive Makeover", price: "$149", desc: "Collaborate directly with a senior HR manager to restructure, redesign, and keywords-optimize your executive level profile.", icon: FileText },
    { title: "Mock Interview with Lead Recruiter", price: "$95", desc: "A 45-minute live behavioral session simulating realistic high-stakes corporate recruitment with feedback analysis report.", icon: MessageSquare },
    { title: "Continuous Job-Hunt Advocacy", price: "$299/mo", desc: "Active placement outreach, direct representation to target agencies, and daily customized curation.", icon: HeartHandshake }
  ];

  const businessServices = [
    { title: "Hiring Funnel Setup & Strategy", price: "$499", desc: "Customized setup of automated screening gates, custom test blueprints, and structural HR mapping.", icon: Layers },
    { title: "Managed Sourcing Campaign", price: "$850/role", desc: "Full-lifecycle external search, cold outreach to top candidates, dynamic selection filters, and targeted shortlists.", icon: Users },
    { title: "Interim HR Advisory Hours", price: "$120/hr", desc: "On-demand executive counsel on workforce planning, local compliance regulations, and scale planning.", icon: PhoneCall }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-24">
      
      {/* 1. TOP SPACER: Pushes app content down out of overlapping Shared Iframe headers */}
      <div className="bg-slate-950/90 border-b border-slate-900 py-3 px-4 text-center">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Navigation blocked by your browser's top bar? Use the <span className="text-indigo-400 font-bold">Bottom Dock</span> below!</span>
        </p>
      </div>

      {/* HEADER NAVIGATION (Set to relative so it respects the top spacer and stays reachable) */}
      <header className="relative z-40 bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('landing')}>
            <div className="bg-gradient-to-tr from-indigo-500 to-violet-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent">
                TalentFlow AI
              </span>
              <span className="block text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Next-Gen Placement Suite</span>
            </div>
          </div>

          <div className="hidden md:flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button 
              onClick={() => { setView('landing'); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${view === 'landing' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Home Ecosystem
            </button>
            <button 
              onClick={() => { setView('candidate'); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${view === 'candidate' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Candidates Core
            </button>
            <button 
              onClick={() => { setView('business'); }}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${view === 'business' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Small Businesses
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              title="API Configuration"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/50"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {/* Quick Portal Switchers (Mobile friendly) */}
            <div className="md:hidden flex space-x-1">
              <button 
                onClick={() => setView('candidate')} 
                className={`p-1.5 rounded-lg text-xs font-semibold ${view === 'candidate' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Candidates
              </button>
              <button 
                onClick={() => setView('business')} 
                className={`p-1.5 rounded-lg text-xs font-semibold ${view === 'business' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Businesses
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SETTINGS PANEL (API OVERRIDE) */}
      {showSettings && (
        <div className="bg-slate-950 border-b border-indigo-500/20 px-4 py-5 transition-all">
          <div className="max-w-xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Sandbox API Engine Config
              </h3>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">Automatic Fallback Active</span>
            </div>
            <p className="text-xs text-slate-400">
              The environment handles authentication transparently. However, you can paste your custom Gemini API key below if you wish to override the Sandbox instance credentials.
            </p>
            <div className="flex gap-2">
              <input 
                type="password"
                placeholder="AI Core API Key override..."
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-600"
              />
              {customKey && (
                <button 
                  onClick={() => setCustomKey('')}
                  className="px-3 py-2 bg-red-950 hover:bg-red-900 text-red-300 text-xs rounded-lg transition-all"
                >
                  Clear Override
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1">

        {/* LOADING & ERROR OVERLAYS (GLOBAL DISPATCH) */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-violet-400 absolute inset-0 m-auto animate-bounce" />
            </div>
            <h4 className="mt-6 text-lg font-bold text-slate-200 tracking-wide">Syncing with AI Engine...</h4>
            <p className="text-xs text-slate-400 mt-2 max-w-sm text-center">Formulating highly professional feedback vectors based on standard HR frameworks.</p>
          </div>
        )}

        {apiError && (
          <div className="bg-red-950/80 border-y border-red-500/30 px-4 py-3 text-center text-xs text-red-200 flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{apiError}</span>
            <button 
              onClick={() => setApiError('')} 
              className="ml-4 font-bold uppercase hover:underline text-red-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: LANDING ECOSYSTEM */}
        {/* ======================================================== */}
        {view === 'landing' && (
          <div className="space-y-20 pb-20">
            {/* HERO SECTION */}
            <div className="relative overflow-hidden pt-12 md:pt-24 pb-16 bg-gradient-to-b from-indigo-950/20 via-slate-900/50 to-slate-900">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
              
              <div className="max-w-5xl mx-auto px-4 text-center relative z-10 space-y-6">
                <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">
                  <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  <span className="text-xs text-indigo-300 font-medium tracking-wide">Enterprise Talent Tech for Everyone</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
                  Accelerating Talent Discovery,{' '}
                  <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                    Refined by Intelligence
                  </span>
                </h1>

                <p className="text-slate-400 text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
                  Dual-focused HR toolset empowering modern job hunters to land their dream positions and small businesses to construct high-performance hiring funnels instantly.
                </p>

                <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => { setView('candidate'); setCandidateTab('cv-optimizer'); }}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
                  >
                    <User className="w-5 h-5" /> I am a Candidate
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => { setView('business'); setBusinessTab('jd-generator'); }}
                    className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
                  >
                    <Briefcase className="w-5 h-5 text-violet-400" /> I am an Employer
                  </button>
                </div>

                {/* Micro Stats Banner */}
                <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/80 backdrop-blur-sm">
                    <span className="block text-2xl font-bold text-white">98%</span>
                    <span className="text-xs text-slate-400">CV Keyword Alignment Score</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/80 backdrop-blur-sm">
                    <span className="block text-2xl font-bold text-white">&lt; 3 Min</span>
                    <span className="text-xs text-slate-400">JD Generation Pipeline</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/80 backdrop-blur-sm">
                    <span className="block text-2xl font-bold text-white">4.9/5</span>
                    <span className="text-xs text-slate-400">Candidate Interview Confidence</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800/80 backdrop-blur-sm">
                    <span className="block text-2xl font-bold text-white">0s Setup</span>
                    <span className="text-xs text-slate-400">Instant AI Recruiter Readiness</span>
                  </div>
                </div>
              </div>
            </div>

            {/* THE TWO PATHWAYS COMPARED */}
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-8">
              {/* CANDIDATE SIDE */}
              <div className="bg-slate-800/30 rounded-2xl p-8 border border-indigo-500/10 hover:border-indigo-500/20 transition-all flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">For Candidates</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Elevate your marketability with enterprise-grade recruitment assets, accurate competency validation, and dynamic role discovery tools.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Bullet-by-bullet AI CV optimizer and grading
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Competency matcher mapping gap-analysis
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Interactive dynamic mock interview simulator
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => { setView('candidate'); setCandidateTab('cv-optimizer'); }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 border border-indigo-500/20 hover:border-indigo-500/40"
                >
                  Enter Candidate Suite <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* BUSINESS SIDE */}
              <div className="bg-slate-800/30 rounded-2xl p-8 border border-violet-500/10 hover:border-violet-500/20 transition-all flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">For Small Businesses</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Skip bloated agency retainers. Launch standard compliant campaigns, auto-screen piles of applications, and create structured grading guidelines instantly.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Compliant AI job description generator
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Match screening engine mapping resume gaps
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> Structural interview blueprint guide generator
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => { setView('business'); setBusinessTab('jd-generator'); }}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-violet-400 font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 border border-violet-500/20 hover:border-violet-500/40"
                >
                  Enter Business Suite <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TRUST BANNER / METHODOLOGY */}
            <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
              <h4 className="text-xs uppercase tracking-widest font-bold text-indigo-400">The Method behind the Algorithm</h4>
              <p className="text-slate-300 max-w-2xl mx-auto text-sm leading-relaxed">
                TalentFlow AI maps technical & soft competencies using recognized standards (SFIA, O*NET, and high-impact STAR response metrics). You receive real, practical optimization frameworks instead of generic synonyms.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 text-left">
                  <Award className="w-5 h-5 text-indigo-400 mb-2" />
                  <h5 className="font-bold text-white text-sm mb-1">Target Alignment</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">Ensuring your competencies exactly match active recruiter indexing logic.</p>
                </div>
                <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 text-left">
                  <TrendingUp className="w-5 h-5 text-violet-400 mb-2" />
                  <h5 className="font-bold text-white text-sm mb-1">Career Escalation</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">Defining clear development tasks to easily transition to high compensation tiers.</p>
                </div>
                <div className="p-5 rounded-xl bg-slate-800/20 border border-slate-800 text-left">
                  <ShieldAlert className="w-5 h-5 text-pink-400 mb-2" />
                  <h5 className="font-bold text-white text-sm mb-1">Bias Minimization</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">Structured evaluation systems focusing on proven expertise over pedigree.</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: CANDIDATE PORTAL */}
        {/* ======================================================== */}
        {view === 'candidate' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            
            {/* Header section with profile overview */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-800 pb-6">
              <div>
                <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Portal Access</span>
                <h2 className="text-3xl font-black tracking-tight text-white mt-1">Candidates Hub</h2>
                <p className="text-slate-400 text-sm mt-0.5">Optimize your professional assets, test your performance level, and map active matches.</p>
              </div>
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 max-w-full overflow-x-auto">
                <button
                  onClick={() => setCandidateTab('cv-optimizer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${candidateTab === 'cv-optimizer' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  AI CV Optimizer
                </button>
                <button
                  onClick={() => setCandidateTab('job-matcher')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${candidateTab === 'job-matcher' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Job Matcher
                </button>
                <button
                  onClick={() => setCandidateTab('interview-prep')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${candidateTab === 'interview-prep' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  AI Mock Simulator
                </button>
                <button
                  onClick={() => setCandidateTab('pro-services')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${candidateTab === 'pro-services' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Premium Services
                </button>
              </div>
            </div>

            {/* TAB CONTENT: CV OPTIMIZER */}
            {candidateTab === 'cv-optimizer' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Form column */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" /> Executive CV Refiner
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Insert your existing resume profile text, professional bullet points, or list of achievements. We'll analyze impact metrics, identify soft spots, and construct high-impact alternatives.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Job Title (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Senior Full-Stack Engineer, Director of Product"
                          value={cvTargetRole}
                          onChange={(e) => setCvTargetRole(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-sm text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Existing Resume / Achievements Data</label>
                        <textarea 
                          rows={10}
                          placeholder="Paste your biography, existing bullet points or accomplishments list here..."
                          value={cvInput}
                          onChange={(e) => setCvInput(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                        ></textarea>
                      </div>

                      <button
                        onClick={handleOptimizeCV}
                        disabled={!cvInput.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15"
                      >
                        <Sparkles className="w-4 h-4 animate-bounce" /> Analyze & Refine CV
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feedback column */}
                <div className="lg:col-span-7 space-y-6">
                  {cvFeedback ? (
                    <div className="space-y-6">
                      {/* Score card */}
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800/80 flex items-center justify-between gap-6">
                        <div className="space-y-1">
                          <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest">Alignment Score</span>
                          <h4 className="text-2xl font-black text-white">Analysis Finished</h4>
                          <p className="text-xs text-slate-400">Based on competitive market standards of recruiters.</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center text-white font-black text-xl">
                            {cvFeedback.overallScore}
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1">out of 100</span>
                        </div>
                      </div>

                      {/* Strengths & Gaps */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
                          <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Strengths Detected
                          </h5>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {cvFeedback.strengths?.map((str, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-emerald-500 mt-0.5">•</span> {str}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                          <h5 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> Identified Gaps
                          </h5>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {cvFeedback.gaps?.map((gap, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-amber-500 mt-0.5">•</span> {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Revised Bullet Points */}
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-400" /> Strategic Action-Oriented Re-writes
                          </h4>
                          <button 
                            onClick={() => handleClipboardCopy(cvFeedback.revisedBullets?.join('\n'))}
                            className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Clipboard className="w-3.5 h-3.5" /> Copy Revised Bullets
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          We redesigned your achievements to follow the STAR methodology (Situation, Task, Action, Result), integrating measurable metrics.
                        </p>
                        <div className="space-y-3">
                          {cvFeedback.revisedBullets?.map((bullet, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 relative group">
                              <span className="absolute left-2.5 top-3.5 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              <p className="text-xs text-slate-200 leading-relaxed pl-4 pr-10">{bullet}</p>
                              <button 
                                onClick={() => handleClipboardCopy(bullet)}
                                className="absolute right-3 top-3.5 opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-white transition-all bg-slate-800 px-2 py-0.5 rounded"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Global Improvement Advice */}
                      <div className="bg-indigo-950/20 rounded-2xl p-6 border border-indigo-500/10 space-y-3">
                        <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" /> Comprehensive Optimization Guide
                        </h4>
                        <ul className="space-y-2 text-xs text-slate-300">
                          {cvFeedback.optimizationSuggestions?.map((sug, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-indigo-400 font-bold">{idx + 1}.</span>
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                      <h4 className="text-sm font-semibold text-slate-400">Feedback Engine Ready</h4>
                      <p className="text-xs max-w-xs mt-1">Input your CV profile and targeted job on the left to see advanced structural recommendations.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: JOB MATCHER */}
            {candidateTab === 'job-matcher' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Selector Column */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-400" /> Career Profile Matcher
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Evaluate where your current skill portfolio places you in the marketplace. Input your practical abilities and target domain to match active high-value positions.
                    </p>

                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Your Key Skills & Competence Areas</label>
                        <textarea 
                          rows={4}
                          placeholder="e.g. JavaScript, AWS Architecture, Project Management methodologies, Scrum, client relations, budget forecasting..."
                          value={competencies}
                          onChange={(e) => setCompetencies(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        ></textarea>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Experience Level</label>
                          <select 
                            value={experienceLevel}
                            onChange={(e) => setExperienceLevel(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            <option value="entry">Entry/Junior (&lt; 2 Yrs)</option>
                            <option value="mid">Mid-Weight (2-5 Yrs)</option>
                            <option value="senior">Senior Analyst (5-8 Yrs)</option>
                            <option value="lead">Lead/Principal (&gt; 8 Yrs)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Preferred Industry</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Tech, Finance, Health"
                            value={preferredIndustry}
                            onChange={(e) => setPreferredIndustry(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleMatchJobs}
                        disabled={!competencies.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15"
                      >
                        <TrendingUp className="w-4 h-4" /> Calculate Market Alignment
                      </button>
                    </div>
                  </div>
                </div>

                {/* Matcher Results Column */}
                <div className="lg:col-span-7 space-y-6">
                  {matcherResult ? (
                    <div className="space-y-6">
                      
                      {/* Overall Fit rating */}
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest">Aggregate Market Alignment</span>
                          <h4 className="text-2xl font-black text-white mt-1">Excellent Positioning</h4>
                          <p className="text-xs text-slate-400 mt-1">Your core competencies map strongly to key global open positions.</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-4xl font-extrabold text-indigo-400">{matcherResult.fitScore}%</span>
                          <span className="text-[10px] text-slate-500 uppercase">Fit Index Rating</span>
                        </div>
                      </div>

                      {/* Match suggestions */}
                      <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400">Target Role Matches</h4>
                      
                      <div className="space-y-4">
                        {matcherResult.matchedRoles?.map((role, idx) => (
                          <div key={idx} className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                              <div>
                                <h5 className="font-bold text-white text-base">{role.title}</h5>
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">{role.level} Level</span>
                              </div>
                              <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-center">
                                <span className="block text-[10px] text-indigo-400 font-bold uppercase">Estimated Compensations</span>
                                <span className="text-xs text-white font-bold">{role.salaryRangeEstimate}</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">
                              <span className="font-semibold text-indigo-300">Why this matches:</span> {role.suitabilityReason}
                            </p>

                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">Recommended Gap Enhancements</span>
                              <div className="flex flex-wrap gap-1.5">
                                {role.topGaps?.map((gap, gIdx) => (
                                  <span key={gIdx} className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                                    {gap}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Continuous advice */}
                      <div className="bg-indigo-950/20 rounded-2xl p-6 border border-indigo-500/10 space-y-2">
                        <h4 className="text-xs uppercase tracking-widest font-bold text-indigo-400">Career Expansion Blueprint</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{matcherResult.skillsEnhancementAdvice}</p>
                      </div>

                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Layers className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                      <h4 className="text-sm font-semibold text-slate-400">Matching Engine Ready</h4>
                      <p className="text-xs max-w-xs mt-1">Submit your capability portfolio to calculate alignment maps across modern hiring requirements.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: INTERVIEW SIMULATOR */}
            {candidateTab === 'interview-prep' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-400" /> Interactive AI Mock Recruiter
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-normal">
                      Simulate high-fidelity interviews. The AI acts as your recruiter, asking questions in succession. You type answers, and receive an updated score and customized development coaching on every turn!
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Role of Simulation</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Sales Executive, Senior Frontend Lead"
                          value={interviewRole}
                          onChange={(e) => setInterviewRole(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Interview Style Core</label>
                        <select
                          value={interviewType}
                          onChange={(e) => setInterviewType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="behavioral">Behavioral (STAR Method Focus)</option>
                          <option value="technical">Technical Competencies & Case Questions</option>
                          <option value="competency">Strategic Problem Solving Scenarios</option>
                        </select>
                      </div>

                      <button
                        onClick={handleStartInterview}
                        disabled={!interviewRole.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Start Active Simulation
                      </button>
                    </div>
                  </div>

                  {interviewStarted && (
                    <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-3.5">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400">Live Session Stats</h4>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="block text-2xl font-bold text-indigo-400">
                            {interviewStats.turns > 0 ? Math.round(interviewStats.scoreSum / interviewStats.turns) : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Avg Quality Score</span>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="block text-2xl font-bold text-white">{interviewStats.turns}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Questions Taken</span>
                        </div>
                      </div>
                      
                      {lastFeedback && (
                        <div className="p-3.5 bg-indigo-950/20 rounded-xl border border-indigo-500/10 text-xs text-slate-300 leading-relaxed">
                          <strong className="text-indigo-400 block mb-1">Last Turn Coaching Feedback:</strong>
                          {lastFeedback}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Simulated Chat Interface */}
                <div className="lg:col-span-8 flex flex-col h-[550px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                  
                  {/* Chat Top Info */}
                  <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${interviewStarted ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                      <div>
                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Session Console</h4>
                        {interviewStarted && (
                          <p className="text-[10px] text-slate-400">Role: <span className="text-slate-200">{interviewRole}</span> ({interviewType})</p>
                        )}
                      </div>
                    </div>
                    {interviewStarted && (
                      <button 
                        onClick={() => { setInterviewStarted(false); setInterviewHistory([]); }}
                        className="text-[10px] text-red-400 hover:underline hover:text-red-300"
                      >
                        Reset Session
                      </button>
                    )}
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {interviewHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 max-w-sm mx-auto">
                        <MessageSquare className="w-12 h-12 text-slate-800 mb-2" />
                        <h4 className="text-xs font-semibold text-slate-400">Recruitment Terminal Idle</h4>
                        <p className="text-[11px] text-slate-500 mt-1">Configure your target role and click &quot;Start Active Simulation&quot; to begin your interview prep challenge.</p>
                      </div>
                    ) : (
                      interviewHistory.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'candidate' ? 'items-end' : 'items-start'} space-y-1`}>
                          
                          {/* Sender badge */}
                          <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-widest">
                            {msg.role === 'candidate' ? 'You' : 'AI Recruiter (Advisor)'}
                          </span>

                          <div className={`max-w-md p-4 rounded-2xl text-xs leading-relaxed ${
                            msg.role === 'candidate' 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                          }`}>
                            <p>{msg.text}</p>
                            
                            {/* Inner competency indicator */}
                            {msg.competency && (
                              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[9px] text-indigo-400 flex justify-between items-center">
                                <span>Testing Scope: {msg.competency}</span>
                                {msg.score !== undefined && (
                                  <span className="font-extrabold bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300">
                                    Quality Score: {msg.score}/100
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input controls */}
                  <div className="bg-slate-900 border-t border-slate-800 p-4">
                    <div className="flex gap-2">
                      <textarea
                        disabled={!interviewStarted}
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAnswerSubmit();
                          }
                        }}
                        placeholder={interviewStarted ? "Compose your response answer here... Press Enter to send." : "Start session first..."}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none h-12"
                      />
                      <button
                        onClick={handleAnswerSubmit}
                        disabled={!interviewStarted || !userAnswer.trim()}
                        className="px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-4 h-4" /> Send
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB CONTENT: CANDIDATE PREMIUM MARKETPLACE SERVICES */}
            {candidateTab === 'pro-services' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-indigo-950/20 via-slate-900/50 to-slate-900 rounded-2xl p-6 border border-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest">Co-managed HR Success</span>
                    <h3 className="text-xl font-bold text-white">Need a Certified Recruiter in your corner?</h3>
                    <p className="text-xs text-slate-400">Combine algorithmic precision with elite veteran hiring advocates to dramatically increase candidate callbacks.</p>
                  </div>
                  <button 
                    onClick={() => handleOpenBooking({ title: "Custom Career Strategic Consult", price: "Free Discovery Call" })}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-600/15"
                  >
                    Schedule Free Intake Call
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {candidateServices.map((service, idx) => {
                    const IconComponent = service.icon;
                    return (
                      <div key={idx} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800 hover:border-indigo-500/20 transition-all flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-lg font-bold text-white block">{service.title}</span>
                            <span className="text-sm font-black text-indigo-300 block mt-0.5">{service.price}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{service.desc}</p>
                        </div>
                        <button
                          onClick={() => handleOpenBooking(service)}
                          className="w-full py-2 bg-slate-850 hover:bg-indigo-600 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all border border-slate-800 hover:border-transparent"
                        >
                          Book Professional Package
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: BUSINESS PORTAL */}
        {/* ======================================================== */}
        {view === 'business' && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            
            {/* Header section with business overview */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-800 pb-6">
              <div>
                <span className="text-xs font-semibold text-violet-400 tracking-wider uppercase">Employer Console</span>
                <h2 className="text-3xl font-black tracking-tight text-white mt-1">Small Business Hub</h2>
                <p className="text-slate-400 text-sm mt-0.5">Create clean, strategic job publications, instantly filter applications, and blueprint structural team questions.</p>
              </div>
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 max-w-full overflow-x-auto">
                <button
                  onClick={() => setBusinessTab('jd-generator')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${businessTab === 'jd-generator' ? 'bg-violet-600 text-white animate-fade' : 'text-slate-400 hover:text-white'}`}
                >
                  AI JD Generator
                </button>
                <button
                  onClick={() => setBusinessTab('candidate-screener')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${businessTab === 'candidate-screener' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Match Screener
                </button>
                <button
                  onClick={() => setBusinessTab('blueprint')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${businessTab === 'blueprint' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Question Blueprint
                </button>
                <button
                  onClick={() => setBusinessTab('pro-services')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${businessTab === 'pro-services' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Employer Services
                </button>
              </div>
            </div>

            {/* TAB CONTENT: JD GENERATOR */}
            {businessTab === 'jd-generator' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Inputs */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-violet-400" /> Compliant Profile Generator
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Build publication-ready job descriptions optimizing requirements for diversity, compliance alignment, and structural grading clarity.
                    </p>

                    <div className="space-y-3.5 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Target Title</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Account Executive"
                            value={jdTitle}
                            onChange={(e) => setJdTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Enterprise Sales"
                            value={jdDept}
                            onChange={(e) => setJdDept(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Seniority / Level</label>
                        <select
                          value={jdSeniority}
                          onChange={(e) => setJdSeniority(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          <option value="Associate/Entry">Associate/Junior Level</option>
                          <option value="Mid-Level">Mid-Level Professional</option>
                          <option value="Senior Leader">Senior Specialist / Team Lead</option>
                          <option value="Executive Principal">Director / Executive Leadership</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Key Responsibilities & Skills Required</label>
                        <textarea 
                          rows={4}
                          placeholder="List fundamental outcomes: e.g. Handle high-volume pipelines, proficiency with Hubspot, Salesforce management, run outbound product demonstrations..."
                          value={jdSkills}
                          onChange={(e) => setJdSkills(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        ></textarea>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Company Culture / Ethos Pitch (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Remote-first, high autonomy, rapid shipping cycles..."
                          value={jdCulture}
                          onChange={(e) => setJdCulture(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleGenerateJD}
                        disabled={!jdTitle.trim() || !jdSkills.trim()}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/15"
                      >
                        <Sparkles className="w-4 h-4" /> Assemble Compliant JD
                      </button>
                    </div>
                  </div>
                </div>

                {/* Outputs Display */}
                <div className="lg:col-span-7 space-y-6">
                  {jdResult ? (
                    <div className="space-y-6">
                      
                      {/* Interactive Header with Copy buttons */}
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">JD Structure Assembled</span>
                          <h4 className="text-xl font-bold text-white mt-1">{jdResult.title}</h4>
                          <span className="text-xs text-slate-400">{jdResult.department} Department</span>
                        </div>
                        <button
                          onClick={() => handleClipboardCopy(`
Job Title: ${jdResult.title}
Department: ${jdResult.department}

Overview:
${jdResult.overview}

Responsibilities:
${jdResult.responsibilities?.map(r => `* ${r}`).join('\n')}

Requirements:
${jdResult.requirements?.map(req => `* ${req}`).join('\n')}

Nice-To-Haves:
${jdResult.preferredQualifications?.map(p => `* ${p}`).join('\n')}

Benefits & Compensation:
* Estimated scale: ${jdResult.compensationRange}
${jdResult.benefits?.map(b => `* ${b}`).join('\n')}
                          `)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-violet-400 hover:text-white transition-all border border-slate-700/60 flex items-center gap-2"
                        >
                          <Clipboard className="w-4 h-4" /> Copy Entire Profile
                        </button>
                      </div>

                      {/* Content Blocks */}
                      <div className="space-y-5">
                        
                        {/* Core Overview */}
                        <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-800 space-y-2">
                          <h5 className="text-xs font-extrabold text-violet-400 uppercase tracking-widest">Role Strategy & Context</h5>
                          <p className="text-xs text-slate-300 leading-relaxed">{jdResult.overview}</p>
                        </div>

                        {/* Two Columns: Responsibilities & Requirements */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
                            <h5 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-violet-400" /> Expected Outcomes
                            </h5>
                            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                              {jdResult.responsibilities?.map((item, i) => (
                                <li key={i} className="leading-relaxed">{item}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-3">
                            <h5 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                              <ShieldAlert className="w-3.5 h-3.5 text-violet-400" /> Essential Requirements
                            </h5>
                            <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                              {jdResult.requirements?.map((item, i) => (
                                <li key={i} className="leading-relaxed">{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Nice to Haves */}
                        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
                          <h5 className="text-xs font-extrabold text-white uppercase tracking-widest">Nice-To-Have Assets</h5>
                          <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                            {jdResult.preferredQualifications?.map((item, i) => (
                              <li key={i} className="leading-relaxed">{item}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Comp & Perks */}
                        <div className="p-5 rounded-2xl bg-violet-950/20 border border-violet-500/20 space-y-3">
                          <div className="flex items-center justify-between border-b border-violet-500/10 pb-2">
                            <h5 className="text-xs font-extrabold text-violet-400 uppercase tracking-widest">Compensation & Perks package</h5>
                            <span className="text-xs font-bold text-white bg-violet-500/20 px-2 py-0.5 rounded">
                              {jdResult.compensationRange}
                            </span>
                          </div>
                          <ul className="space-y-1 text-xs text-slate-300">
                            {jdResult.benefits?.map((item, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <span className="text-violet-400 font-bold">•</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                      <h4 className="text-sm font-semibold text-slate-400">Content Engine Standby</h4>
                      <p className="text-xs max-w-xs mt-1">Define target profiles, levels and attributes to generate compliant structural job listings.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CANDIDATE SCREENER */}
            {businessTab === 'candidate-screener' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Forms column */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-violet-400" /> Resume Screener Assistant
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Cross-compare an incoming candidate's resume directly against the target JD requirements. This highlights exact matches, misses, and forms tailored interview defense questions.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Job Description (JD)</label>
                        <textarea 
                          rows={4}
                          placeholder="Paste details of the role description here..."
                          value={screenerJD}
                          onChange={(e) => setScreenerJD}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                        ></textarea>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Applicant Resume / Profile</label>
                        <textarea 
                          rows={6}
                          placeholder="Paste candidate resume, CV details, or parsed text biography here..."
                          value={screenerResume}
                          onChange={(e) => setScreenerResume(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                        ></textarea>
                      </div>

                      <button
                        onClick={handleScreenCandidate}
                        disabled={!screenerJD.trim() || !screenerResume.trim()}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 animate-spin" /> Cross-Screen Applicant
                      </button>
                    </div>
                  </div>
                </div>

                {/* Match Metrics Display */}
                <div className="lg:col-span-7 space-y-6">
                  {screenerResult ? (
                    <div className="space-y-6">
                      
                      {/* Overall Fit rating */}
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">Algorithmic Suitability Score</span>
                          <h4 className="text-xl font-bold text-white mt-1">Screening Completed</h4>
                          <p className="text-xs text-slate-400">Comparing technical skill density & career longevity.</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-4xl font-extrabold text-violet-400">{screenerResult.suitabilityScore}%</span>
                          <span className="text-[10px] text-slate-500 uppercase">Requirements Fit</span>
                        </div>
                      </div>

                      {/* Technical Breakdown (Gaps vs matches) */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2.5">
                          <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Skills Matched
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {screenerResult.skillsMatched?.map((skill, idx) => (
                              <span key={idx} className="bg-emerald-500/15 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-medium">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-2.5">
                          <h5 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> Skills Missing / Weak
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {screenerResult.skillsMissing?.map((skill, idx) => (
                              <span key={idx} className="bg-red-500/15 text-red-300 text-[10px] px-2 py-0.5 rounded font-medium">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Deep Analysis Strengths & Concerns */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
                          <h5 className="text-xs font-bold text-white uppercase tracking-widest">Candidate Strengths</h5>
                          <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
                            {screenerResult.strengths?.map((str, i) => <li key={i}>{str}</li>)}
                          </ul>
                        </div>
                        <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
                          <h5 className="text-xs font-bold text-white uppercase tracking-widest">Hiring Concerns / Risks</h5>
                          <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
                            {screenerResult.concerns?.map((con, i) => <li key={i}>{con}</li>)}
                          </ul>
                        </div>
                      </div>

                      {/* Tailored Interview Screening Questions */}
                      <div className="bg-violet-950/20 rounded-2xl p-6 border border-violet-500/20 space-y-4">
                        <h4 className="text-sm font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" /> Recommended Defense Questions for HR
                        </h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          These exact situational questions are custom generated to specifically test and validate the identified skill gaps and concerns during active screenings.
                        </p>
                        <div className="space-y-3">
                          {screenerResult.customInterviewQuestions?.map((q, idx) => (
                            <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex gap-3 items-start">
                              <span className="text-xs font-bold bg-violet-500/20 text-violet-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed">{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Users className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                      <h4 className="text-sm font-semibold text-slate-400">Match Screening Terminal Ready</h4>
                      <p className="text-xs max-w-xs mt-1">Submit target details and the applicant CV text to populate analytical cross scores and recommendations.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: INTERVIEW BLUEPRINT */}
            {businessTab === 'blueprint' && (
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Inputs */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Clipboard className="w-5 h-5 text-violet-400" /> Interview Question Architect
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Construct psychologist-validated interview matrices mapped against custom professional competencies. Ideal for setting uniform criteria across multiple external interviewers.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Job Title</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Lead Customer Support Representative"
                          value={blueprintRole}
                          onChange={(e) => setBlueprintRole(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Competencies of Focus (Optional)</label>
                        <textarea 
                          rows={4}
                          placeholder="e.g. Crisis resilience, empathy standards, complex system tracking, mentorship potential..."
                          value={blueprintFocus}
                          onChange={(e) => setBlueprintFocus(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        ></textarea>
                      </div>

                      <button
                        onClick={handleCreateBlueprint}
                        disabled={!blueprintRole.trim()}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Synthesize Question Blueprint
                      </button>
                    </div>
                  </div>
                </div>

                {/* Outputs Display */}
                <div className="lg:col-span-7 space-y-6">
                  {blueprintResult ? (
                    <div className="space-y-6">
                      
                      <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">Blueprint Ready</span>
                          <h4 className="text-xl font-bold text-white mt-1">Structural Grading Guide</h4>
                          <p className="text-xs text-slate-400">Structured competency scoring for hiring managers.</p>
                        </div>
                      </div>

                      {/* Map Focus Areas */}
                      {blueprintResult.focusAreas?.map((area, idx) => (
                        <div key={idx} className="bg-slate-800/40 rounded-2xl p-6 border border-slate-800 space-y-4">
                          
                          <div className="flex justify-between items-start border-b border-slate-800 pb-3 gap-2">
                            <div>
                              <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">Competency Map {idx+1}</span>
                              <h5 className="font-bold text-white text-base">{area.competency}</h5>
                            </div>
                            <span className="text-[10px] font-bold bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Importance: {area.importance}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Structural Scenario Questions</span>
                            {area.questions?.map((q, qIdx) => (
                              <div key={qIdx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-mono">
                                &quot;{q}&quot;
                              </div>
                            ))}
                          </div>

                          <div className="p-3.5 bg-violet-950/20 border border-violet-500/10 rounded-xl space-y-1">
                            <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest block">What to Look For (Evaluation Standard)</span>
                            <p className="text-xs text-slate-300 leading-relaxed">{area.whatToLookFor}</p>
                          </div>

                        </div>
                      ))}

                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Clipboard className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
                      <h4 className="text-sm font-semibold text-slate-400">Blueprint Engine Standby</h4>
                      <p className="text-xs max-w-xs mt-1">Specify role details on the left to map deep behavioral matrices and questions.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: BUSINESS PREMIUM MARKETPLACE SERVICES */}
            {businessTab === 'pro-services' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-violet-950/20 via-slate-900/50 to-slate-900 rounded-2xl p-6 border border-violet-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest">Co-managed Corporate Scale</span>
                    <h3 className="text-xl font-bold text-white">Need an Expert Recruitment Architect?</h3>
                    <p className="text-xs text-slate-400">Scale your department easily. Get dedicated recruitment operators to build, curate, and scale custom pipeline setups for you.</p>
                  </div>
                  <button 
                    onClick={() => handleOpenBooking({ title: "Custom Hiring Strategy intake", price: "Free Discovery Call" })}
                    className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-violet-600/15"
                  >
                    Schedule Free Consultation
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {businessServices.map((service, idx) => {
                    const IconComponent = service.icon;
                    return (
                      <div key={idx} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800 hover:border-violet-500/20 transition-all flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-lg font-bold text-white block">{service.title}</span>
                            <span className="text-sm font-black text-violet-300 block mt-0.5">{service.price}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{service.desc}</p>
                        </div>
                        <button
                          onClick={() => handleOpenBooking(service)}
                          className="w-full py-2 bg-slate-850 hover:bg-violet-600 text-xs font-semibold rounded-lg text-slate-300 hover:text-white transition-all border border-slate-800 hover:border-transparent"
                        >
                          Request Custom Sourcing Offer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* BOOKING MODAL */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 relative space-y-4">
            <button 
              onClick={() => setBookingModal(null)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest">Human Consultant Network</span>
              <h3 className="text-lg font-bold text-white">{bookingModal.title}</h3>
              <span className="text-xs text-slate-400 block">{bookingModal.price} package selection</span>
            </div>

            {bookingSuccess ? (
              <div className="p-6 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-bold text-white text-sm">Consultation Setup Success!</h4>
                <p className="text-xs text-slate-400">Our senior Talent Acquisition advisor will message you shortly to finalize details.</p>
              </div>
            ) : (
              <form onSubmit={handleBookSubmit} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Sarah Connor"
                    value={bookingName}
                    onChange={(e) => setBookingName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. sarah@cyberdyne.co"
                    value={bookingEmail}
                    onChange={(e) => setBookingEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed">
                  By submitting this request, your details are saved securely. One of our lead advisors will review your target role / company requirements within 4 business hours.
                </p>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all"
                >
                  Confirm Discovery Consultation
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PREMIUM BOTTOM FLOATING DOCK (FAILSAFE NAVIGATION) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl px-5 py-3 shadow-2xl shadow-indigo-500/30 flex items-center gap-6 max-w-[95%] sm:max-w-md transition-all">
        <button 
          onClick={() => { setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'landing' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Home</span>
        </button>
        
        <div className="w-px h-6 bg-slate-800"></div>
        
        <button 
          onClick={() => { setView('candidate'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'candidate' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Candidates</span>
        </button>
        
        <div className="w-px h-6 bg-slate-800"></div>
        
        <button 
          onClick={() => { setView('business'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className={`flex flex-col items-center gap-1 transition-all ${view === 'business' ? 'text-indigo-400 scale-105 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Employers</span>
        </button>
      </div>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 px-4 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-1.5 rounded text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">TalentFlow AI</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Premium algorithmic placement suite bridging the gap between small business goals and high-performing candidate placement pipelines.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3">For Candidates</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><button onClick={() => { setView('candidate'); setCandidateTab('cv-optimizer'); }} className="hover:text-indigo-400 transition-all">CV Bullet Optimizer</button></li>
              <li><button onClick={() => { setView('candidate'); setCandidateTab('job-matcher'); }} className="hover:text-indigo-400 transition-all">Competence & Job Matching</button></li>
              <li><button onClick={() => { setView('candidate'); setCandidateTab('interview-prep'); }} className="hover:text-indigo-400 transition-all">AI Mock Simulator</button></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3">For Small Businesses</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><button onClick={() => { setView('business'); setBusinessTab('jd-generator'); }} className="hover:text-violet-400 transition-all">Compliant Job Descriptions</button></li>
              <li><button onClick={() => { setView('business'); setBusinessTab('candidate-screener'); }} className="hover:text-violet-400 transition-all">Applicant Resume Screening</button></li>
              <li><button onClick={() => { setView('business'); setBusinessTab('blueprint'); }} className="hover:text-violet-400 transition-all">Interview Blueprint Guides</button></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3">Safety & Governance</h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This system fully adheres to local equal-opportunity standard employment parameters. AI suggestions are informational blueprints to assist decision processes.
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              © 2026 TalentFlow AI Corp. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}