/**
 * Mock data for testing video analysis features
 * FR-100: General Requirements - Test data generation
 */

import type { VideoAnalysis } from "~types/analysis"

/**
 * High trust score video (educational content)
 */
export const mockAnalysisHighTrust: any = {
  videoId: "dQw4w9WgXcQ",
  videoTitle: "Understanding Climate Change: A Scientific Overview",
  channelName: "Science Explained",
  trustScore: {
    score: 85,
    level: "high",
    factors: [
      {
        name: "Source Credibility",
        score: 90,
        description: "Channel has verified scientific credentials and peer-reviewed content"
      },
      {
        name: "Factual Accuracy",
        score: 88,
        description: "Claims are supported by recent research and data"
      },
      {
        name: "Transparency",
        score: 80,
        description: "Sources and methodology are clearly cited"
      }
    ]
  },
  clickbaitVerdict: {
    verdict: "not-clickbait",
    confidence: 92,
    reasoning: "Title accurately reflects video content with no sensationalism"
  },
  channelCredibility: {
    verifiedStatus: true,
    history: "Consistent track record of accurate scientific content",
    bias: "Minimal - fact-based presentation"
  },
  sentiment: {
    overall: "positive",
    distribution: {
      positive: 65,
      neutral: 30,
      negative: 5
    }
  },
  viewerInsights: [
    {
      type: "actionable",
      statement: "This video provides a clear explanation of greenhouse gases and their impact",
      supportingComments: [
        {
          text: "Finally someone explains this without political bias",
          votes: 1240,
          timestamp: "2 days ago"
        },
        {
          text: "The graphics really help understand the carbon cycle",
          votes: 890,
          timestamp: "1 week ago"
        }
      ]
    },
    {
      type: "caution",
      statement: "Some viewers found the scientific terminology challenging",
      supportingComments: [
        {
          text: "Would be great with a glossary for technical terms",
          votes: 320,
          timestamp: "3 days ago"
        }
      ]
    }
  ],
  contentGaps: {
    overallCoverage: 78,
    unansweredQuestions: [
      {
        category: "clarification",
        statement: "What about the role of deforestation in climate change?",
        supportingComments: [
          {
            text: "Would love to see more about forest ecosystems",
            votes: 456,
            timestamp: "5 days ago"
          }
        ]
      }
    ],
    botDetectionEnabled: true
  },
  analysisMetadata: {
    analyzedAt: new Date().toISOString(),
    commentsSampled: 2500,
    botCommentsFiltered: 180
  }
}

/**
 * Medium trust score video (opinion/analysis)
 */
export const mockAnalysisMediumTrust: any = {
  videoId: "abc123xyz",
  videoTitle: "Top 10 Stock Picks for 2024 - Financial Freedom Awaits!",
  channelName: "InvestSmart Daily",
  trustScore: {
    score: 55,
    level: "moderate",
    factors: [
      {
        name: "Source Credibility",
        score: 60,
        description: "Channel has financial background but not professionally licensed"
      },
      {
        name: "Factual Accuracy",
        score: 50,
        description: "Mix of verifiable data and personal opinions"
      },
      {
        name: "Transparency",
        score: 55,
        description: "Some sources cited, but lacks comprehensive disclosure"
      }
    ]
  },
  clickbaitVerdict: {
    verdict: "moderate-clickbait",
    confidence: 78,
    reasoning: "Title uses attention-grabbing language ('Financial Freedom') but content is related"
  },
  channelCredibility: {
    verifiedStatus: false,
    history: "Inconsistent prediction accuracy in past videos",
    bias: "Moderate - favors growth stocks"
  },
  sentiment: {
    overall: "neutral",
    distribution: {
      positive: 40,
      neutral: 35,
      negative: 25
    }
  },
  viewerInsights: [
    {
      type: "actionable",
      statement: "Good overview of market sectors but lacks risk discussion",
      supportingComments: [
        {
          text: "Interesting picks but DYOR before investing",
          votes: 567,
          timestamp: "1 day ago"
        }
      ]
    },
    {
      type: "warning",
      statement: "Several viewers note discrepancies with current market data",
      supportingComments: [
        {
          text: "These P/E ratios don't match Yahoo Finance",
          votes: 423,
          timestamp: "2 days ago"
        },
        {
          text: "Video recorded before recent market correction",
          votes: 334,
          timestamp: "3 days ago"
        }
      ]
    }
  ],
  contentGaps: {
    overallCoverage: 55,
    unansweredQuestions: [
      {
        category: "concern",
        statement: "No discussion of downside risks or stop-loss strategies",
        supportingComments: [
          {
            text: "Where's the risk management advice?",
            votes: 789,
            timestamp: "1 day ago"
          }
        ]
      },
      {
        category: "clarification",
        statement: "Unclear about time horizon for these picks",
        supportingComments: [
          {
            text: "Are these short-term or long-term holds?",
            votes: 445,
            timestamp: "4 days ago"
          }
        ]
      }
    ],
    botDetectionEnabled: true
  },
  analysisMetadata: {
    analyzedAt: new Date().toISOString(),
    commentsSampled: 1800,
    botCommentsFiltered: 420
  }
}

/**
 * Low trust score video (potential misinformation)
 */
export const mockAnalysisLowTrust: any = {
  videoId: "xyz789def",
  videoTitle: "SHOCKING TRUTH They Don't Want You to Know! 🚨",
  channelName: "TruthSeeker3000",
  trustScore: {
    score: 25,
    level: "low",
    factors: [
      {
        name: "Source Credibility",
        score: 15,
        description: "No verifiable credentials or expertise demonstrated"
      },
      {
        name: "Factual Accuracy",
        score: 20,
        description: "Multiple claims contradict established facts and lack sources"
      },
      {
        name: "Transparency",
        score: 40,
        description: "No sources cited for controversial claims"
      }
    ]
  },
  clickbaitVerdict: {
    verdict: "highly-clickbait",
    confidence: 95,
    reasoning: "Sensational title with shock value and urgency tactics; vague about actual content"
  },
  channelCredibility: {
    verifiedStatus: false,
    history: "History of promoting conspiracy theories and unverified claims",
    bias: "Extreme - promotes fringe theories"
  },
  sentiment: {
    overall: "negative",
    distribution: {
      positive: 15,
      neutral: 25,
      negative: 60
    }
  },
  viewerInsights: [
    {
      type: "warning",
      statement: "Multiple fact-checkers have debunked claims made in this video",
      supportingComments: [
        {
          text: "Snopes article shows this is misleading - [link]",
          votes: 2340,
          timestamp: "1 day ago"
        },
        {
          text: "The 'expert' quoted has no credentials in this field",
          votes: 1890,
          timestamp: "2 days ago"
        }
      ]
    },
    {
      type: "caution",
      statement: "Content may violate platform policies on misinformation",
      supportingComments: [
        {
          text: "Reported this for spreading health misinformation",
          votes: 1567,
          timestamp: "3 hours ago"
        }
      ]
    }
  ],
  contentGaps: {
    overallCoverage: 20,
    unansweredQuestions: [
      {
        category: "concern",
        statement: "No peer-reviewed sources provided for medical claims",
        supportingComments: [
          {
            text: "Where are the scientific studies backing this?",
            votes: 3456,
            timestamp: "1 day ago"
          },
          {
            text: "This contradicts CDC and WHO guidelines",
            votes: 2987,
            timestamp: "2 days ago"
          }
        ]
      }
    ],
    botDetectionEnabled: true
  },
  analysisMetadata: {
    analyzedAt: new Date().toISOString(),
    commentsSampled: 4500,
    botCommentsFiltered: 1200
  }
}

/**
 * Analysis still in progress (loading state)
 */
export const mockAnalysisLoading: any = null

/**
 * Helper function to get mock data by trust level
 */
export function getMockAnalysisByTrustLevel(level: string): any {
  switch (level) {
    case "high":
      return mockAnalysisHighTrust
    case "moderate":
    case "moderate-trust":
      return mockAnalysisMediumTrust
    case "low":
      return mockAnalysisLowTrust
    default:
      return mockAnalysisMediumTrust
  }
}

/**
 * Helper function to get random mock analysis
 */
export function getRandomMockAnalysis(): any {
  const analyses = [
    mockAnalysisHighTrust,
    mockAnalysisMediumTrust,
    mockAnalysisLowTrust
  ]
  return analyses[Math.floor(Math.random() * analyses.length)]
}
