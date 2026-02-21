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

const getScoreColor = (score: number) => {
  if (score < 30) return "#22c55e"; // Green (Safe)
  if (score < 60) return "#f59e0b"; // Amber (Warning)
  return "#ef4444"; // Red (Critical)
};

export default function Popup() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SCORE" }, (response) => {
      if (typeof response === "number") {
        setScore(response);
      }
    });
  }, []);

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

      <div className="w-full px-5 pb-5">
        <Button
          onClick={openLoginPage}
          variant="outline"
          className="block w-full border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
        >
          Login
        </Button>
      </div>
    </div>
  );
}
