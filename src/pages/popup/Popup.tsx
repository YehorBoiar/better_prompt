import { ChartConfig, ChartContainer } from "@src/components/ui/chart";
import { Button } from "@src/components/ui/button";
import {
  Label,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { useEffect, useState } from "react";
import { Info, Lock } from "lucide-react";

const getScoreColor = (score: number) => {
  if (score < 30) return "#22c55e";
  if (score < 60) return "#f59e0b";
  return "#ef4444";
};

export default function Popup() {
  const [score, setScore] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // 1. Check Auth State on Mount
  useEffect(() => {
    chrome.storage.local.get(["session_token"], (result) => {
      setIsLoggedIn(!!result.session_token);
    });
  }, []);

  // 2. Only fetch score if logged in
  useEffect(() => {
    if (isLoggedIn) {
      chrome.runtime.sendMessage({ type: "GET_SCORE" }, (response) => {
        if (typeof response === "number") {
          setScore(response);
        }
      });
    }
  }, [isLoggedIn]);

  const showDetailsOnPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SHOW_DETAILS_OVERLAY" });
        window.close();
      }
    });
  };

  const handleLogout = () => {
    chrome.storage.local.remove("session_token", () => {
      setIsLoggedIn(false);
    });
  };

  const openLoginPage = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("src/pages/options/index.html"));
    }
  };

  const chartData = [
    { name: "Risk", value: score, fill: getScoreColor(score) },
  ];

  const chartConfig = {
    value: { label: "Risk Score" },
  } satisfies ChartConfig;

  // Render nothing while checking storage to prevent UI flicker
  if (isLoggedIn === null) return null;

  // --- LOGGED OUT VIEW ---
  if (!isLoggedIn) {
    return (
      <div className="flex h-[350px] w-[320px] flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
          <Lock className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="mb-2 text-lg font-semibold tracking-tight text-zinc-100">
          Authentication Required
        </h2>
        <p className="mb-8 text-sm text-zinc-400">
          You have to log in before using the extension to evaluate prompts.
        </p>
        <Button
          onClick={openLoginPage}
          className="w-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
        >
          Log in
        </Button>
      </div>
    );
  }

  // --- LOGGED IN VIEW ---
  return (
    <div className="flex w-[320px] flex-col items-center justify-center bg-zinc-950 text-zinc-50">
      <div className="mb-2 mt-5 w-full text-center">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Security Scan
        </h2>
        <p className="text-xs text-zinc-400">Current Input Risk</p>
      </div>

      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full max-w-[250px]"
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={-270}
          innerRadius={80}
          outerRadius={110}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            className="first:fill-zinc-900 last:fill-zinc-950"
            polarRadius={[90, 70]}
          />
          <RadialBar
            dataKey="value"
            background={{ fill: "#27272a" }}
            cornerRadius={10}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-white text-5xl font-bold tracking-tighter"
                      >
                        {chartData[0].value}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 32}
                        className="fill-zinc-400 text-sm font-medium"
                      >
                        Risk Score
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>

      <div className="grid w-full grid-cols-2 gap-3 px-5 pb-5">
        <Button
          variant="outline"
          onClick={showDetailsOnPage}
          className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white"
        >
          <Info className="mr-2 h-4 w-4" /> Details
        </Button>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white border-red-900 hover:bg-red-900"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
