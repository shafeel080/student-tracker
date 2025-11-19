import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatsCard({ title, value, icon: Icon, trend, trendUp, color = "blue" }) {
  const colorClasses = {
    blue: { bg: "bg-blue-500", text: "text-blue-600", bgLight: "bg-blue-50", border: "border-blue-200" },
    emerald: { bg: "bg-emerald-500", text: "text-emerald-600", bgLight: "bg-emerald-50", border: "border-emerald-200" },
    purple: { bg: "bg-purple-500", text: "text-purple-600", bgLight: "bg-purple-50", border: "border-purple-200" },
    amber: { bg: "bg-amber-500", text: "text-amber-600", bgLight: "bg-amber-50", border: "border-amber-200" }
  };

  const colors = colorClasses[color];

  return (
    <Card className={`relative overflow-hidden border ${colors.border} hover:shadow-xl transition-all duration-300 group`}>
      <div className={`absolute top-0 right-0 w-40 h-40 ${colors.bg} opacity-5 rounded-full transform translate-x-16 -translate-y-16 group-hover:scale-110 transition-transform duration-500`} />
      <div className={`absolute bottom-0 left-0 w-32 h-32 ${colors.bg} opacity-5 rounded-full transform -translate-x-12 translate-y-12 group-hover:scale-110 transition-transform duration-500`} />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-600 mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-3">{value}</p>
            {trend && (
              <div className="flex items-center gap-1.5">
                {trendUp !== undefined && (
                  trendUp ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )
                )}
                <span className="text-sm font-medium text-gray-600">
                  {trend}
                </span>
              </div>
            )}
          </div>
          <div className={`p-4 rounded-2xl ${colors.bgLight} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`h-7 w-7 ${colors.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}