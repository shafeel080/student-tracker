import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Target, Users } from "lucide-react";
import { toast } from "sonner";

export default function AIInsights({ data, type = "mentor_performance" }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      let prompt = '';
      
      if (type === "mentor_performance") {
        prompt = `Analyze this mentor performance data and provide 3-4 key insights with actionable recommendations:

Data: ${JSON.stringify(data, null, 2)}

Provide insights in this JSON format:
{
  "summary": "Brief overview",
  "insights": [
    {
      "type": "positive|warning|neutral",
      "title": "Insight title",
      "description": "Detailed description",
      "recommendation": "Actionable recommendation"
    }
  ]
}`;
      } else if (type === "student_risk") {
        prompt = `Analyze student activity data and identify at-risk students:

Data: ${JSON.stringify(data, null, 2)}

Provide analysis in this JSON format:
{
  "summary": "Overall assessment",
  "at_risk_students": [
    {
      "student_name": "Name",
      "risk_level": "high|medium|low",
      "reasons": ["Reason 1", "Reason 2"],
      "recommendations": ["Action 1", "Action 2"]
    }
  ]
}`;
      } else if (type === "commission_trends") {
        prompt = `Analyze commission and deposit trends:

Data: ${JSON.stringify(data, null, 2)}

Provide analysis in this JSON format:
{
  "summary": "Trend overview",
  "trends": [
    {
      "metric": "Metric name",
      "trend": "up|down|stable",
      "change_percentage": "number",
      "insight": "What this means"
    }
  ],
  "predictions": "Future outlook"
}`;
      }

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            insights: { type: "array" },
            at_risk_students: { type: "array" },
            trends: { type: "array" },
            predictions: { type: "string" }
          }
        }
      });

      setInsights(response);
    } catch (error) {
      console.error('AI Insights Error:', error);
      toast.error(`Failed to generate AI insights: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (insightType) => {
    switch(insightType) {
      case 'positive': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default: return <Target className="h-5 w-5 text-blue-600" />;
    }
  };

  const getRiskBadgeColor = (level) => {
    switch(level) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Insights
          </span>
          <Button
            onClick={generateInsights}
            disabled={loading}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!insights && !loading && (
          <p className="text-gray-600 text-center py-4">
            Click "Generate Insights" to get AI-powered analysis
          </p>
        )}

        {insights && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <p className="text-gray-700">{insights.summary}</p>
            </div>

            {/* Performance Insights */}
            {insights.insights && (
              <div className="space-y-3">
                {insights.insights.map((insight, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                        <div className="bg-blue-50 rounded p-2 text-sm text-blue-800">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* At-Risk Students */}
            {insights.at_risk_students && (
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  At-Risk Students
                </h4>
                {insights.at_risk_students.map((student, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium">{student.student_name}</h5>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(student.risk_level)}`}>
                        {student.risk_level} risk
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong className="text-gray-700">Reasons:</strong>
                        <ul className="list-disc list-inside text-gray-600 ml-2">
                          {student.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong className="text-gray-700">Actions:</strong>
                        <ul className="list-disc list-inside text-gray-600 ml-2">
                          {student.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trends */}
            {insights.trends && (
              <div className="space-y-3">
                <h4 className="font-semibold">Trends Analysis</h4>
                {insights.trends.map((trend, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{trend.metric}</p>
                      <p className="text-sm text-gray-600">{trend.insight}</p>
                    </div>
                    <div className={`text-right ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                      <p className="text-2xl font-bold">{trend.change_percentage}%</p>
                      <p className="text-xs">{trend.trend}</p>
                    </div>
                  </div>
                ))}
                {insights.predictions && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                    <strong>Prediction:</strong> {insights.predictions}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}