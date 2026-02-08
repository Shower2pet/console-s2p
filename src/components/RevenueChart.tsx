import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { revenueData } from '@/lib/mock-data';

interface RevenueChartProps {
  type?: 'bar' | 'line';
  title?: string;
  data?: typeof revenueData;
}

export const RevenueChart = ({ type = 'bar', title = 'Ricavi Mensili', data = revenueData }: RevenueChartProps) => (
  <Card className="animate-fade-in">
    <CardHeader className="pb-2">
      <CardTitle className="text-lg font-heading">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={280}>
        {type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(210, 20%, 90%)',
                borderRadius: '0.75rem',
                fontFamily: 'Outfit',
              }}
              formatter={(value: number) => [`€${value.toLocaleString()}`, 'Ricavi']}
            />
            <Bar dataKey="revenue" fill="hsl(207, 100%, 29%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(207, 20%, 46%)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(210, 20%, 90%)',
                borderRadius: '0.75rem',
                fontFamily: 'Outfit',
              }}
              formatter={(value: number) => [`${value}`, 'Lavaggi']}
            />
            <Line type="monotone" dataKey="washes" stroke="hsl(207, 71%, 69%)" strokeWidth={2.5} dot={{ fill: 'hsl(207, 100%, 29%)', r: 4 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
