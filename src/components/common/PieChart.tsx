import React from 'react';

export interface PieChartData {
  name: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  size = 200,
  innerRadius = 0,
  showLabels = true,
  showLegend = true,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  const outerRadius = radius - 10;
  const actualInnerRadius = innerRadius * (outerRadius / radius);
  const centerX = size / 2;
  const centerY = size / 2;

  let currentAngle = -90; // 12時の位置から開始

  const paths = data.map((item, index) => {
    if (item.value === 0) return null;

    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    // 円弧の座標を計算
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + outerRadius * Math.cos(startAngleRad);
    const y1 = centerY + outerRadius * Math.sin(startAngleRad);
    const x2 = centerX + outerRadius * Math.cos(endAngleRad);
    const y2 = centerY + outerRadius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    let pathData = '';
    if (innerRadius > 0) {
      // ドーナツチャート
      const innerX1 = centerX + actualInnerRadius * Math.cos(startAngleRad);
      const innerY1 = centerY + actualInnerRadius * Math.sin(startAngleRad);
      const innerX2 = centerX + actualInnerRadius * Math.cos(endAngleRad);
      const innerY2 = centerY + actualInnerRadius * Math.sin(endAngleRad);

      pathData = `
        M ${x1} ${y1}
        A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${innerX2} ${innerY2}
        A ${actualInnerRadius} ${actualInnerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}
        Z
      `;
    } else {
      // 円グラフ
      pathData = `
        M ${centerX} ${centerY}
        L ${x1} ${y1}
        A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;
    }

    // ラベルの位置を計算
    const labelAngle = (startAngle + angle / 2) * (Math.PI / 180);
    const labelRadius = (outerRadius + actualInnerRadius) / 2;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    currentAngle += angle;

    return {
      pathData,
      item,
      percentage,
      labelX,
      labelY,
      index,
    };
  }).filter(Boolean) as Array<{
    pathData: string;
    item: PieChartData;
    percentage: number;
    labelX: number;
    labelY: number;
    index: number;
  }>;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {paths.map(({ pathData, item, percentage, labelX, labelY, index }) => (
            <g key={index}>
              <path
                d={pathData}
                fill={item.color}
                stroke="white"
                strokeWidth={2}
                className="transition-all duration-300 hover:opacity-80"
              />
              {showLabels && percentage > 0.1 && (
                <g transform={`translate(${labelX}, ${labelY}) rotate(90)`}>
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-gray-900 dark:fill-gray-100 text-xs font-semibold"
                  >
                    {`${(percentage * 100).toFixed(0)}%`}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
      {showLegend && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
          {data.map((item, index) => {
            const percentage = item.value / total;
            return (
              <div
                key={index}
                className="flex items-center space-x-2 text-sm font-['Noto_Sans_JP']"
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700 dark:text-gray-300 flex-1">
                  {item.name}
                </span>
                <span className="text-gray-500 dark:text-gray-400 font-semibold">
                  {item.value.toLocaleString()}
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  ({((percentage * 100).toFixed(1))}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

