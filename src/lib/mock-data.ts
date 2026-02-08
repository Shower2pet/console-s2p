// Role configuration
export type AppRole = 'ADMIN' | 'CLIENTE';
export const CURRENT_ROLE: AppRole = 'ADMIN';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  stations: number;
  totalRevenue: number;
  status: 'active' | 'inactive';
  joinDate: string;
}

export interface Station {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  type: 'basic' | 'premium' | 'deluxe';
  status: 'online' | 'offline' | 'maintenance';
  isActive: boolean;
  dailyRevenue: number;
  totalWashes: number;
  location: string;
}

export interface RevenueData {
  month: string;
  revenue: number;
  washes: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  usageCount: number;
  maxUsage: number;
  expiresAt: string;
  isActive: boolean;
}

export const clients: Client[] = [
  { id: '1', name: 'PetShop Roma', email: 'info@petshoproma.it', phone: '+39 06 1234567', stations: 3, totalRevenue: 12450, status: 'active', joinDate: '2024-03-15' },
  { id: '2', name: 'Lavaggio Fido Milano', email: 'fido@milano.it', phone: '+39 02 9876543', stations: 5, totalRevenue: 28300, status: 'active', joinDate: '2023-11-20' },
  { id: '3', name: 'AquaPet Napoli', email: 'aqua@napoli.it', phone: '+39 081 5551234', stations: 2, totalRevenue: 8900, status: 'active', joinDate: '2024-06-01' },
  { id: '4', name: 'CleanPaws Torino', email: 'clean@torino.it', phone: '+39 011 4445566', stations: 1, totalRevenue: 3200, status: 'inactive', joinDate: '2024-01-10' },
  { id: '5', name: 'BauWash Firenze', email: 'bau@firenze.it', phone: '+39 055 7778899', stations: 4, totalRevenue: 19750, status: 'active', joinDate: '2023-09-05' },
];

export const stations: Station[] = [
  { id: 's1', name: 'Stazione Roma Centro', clientId: '1', clientName: 'PetShop Roma', type: 'premium', status: 'online', isActive: true, dailyRevenue: 145, totalWashes: 1230, location: 'Via Roma 15, Roma' },
  { id: 's2', name: 'Stazione Roma Nord', clientId: '1', clientName: 'PetShop Roma', type: 'basic', status: 'online', isActive: true, dailyRevenue: 98, totalWashes: 870, location: 'Via Flaminia 200, Roma' },
  { id: 's3', name: 'Stazione Roma EUR', clientId: '1', clientName: 'PetShop Roma', type: 'deluxe', status: 'maintenance', isActive: false, dailyRevenue: 0, totalWashes: 560, location: 'Viale Europa 100, Roma' },
  { id: 's4', name: 'Milano Centrale', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'premium', status: 'online', isActive: true, dailyRevenue: 210, totalWashes: 2100, location: 'Corso Buenos Aires 44, Milano' },
  { id: 's5', name: 'Milano Navigli', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 180, totalWashes: 1800, location: 'Alzaia Naviglio 12, Milano' },
  { id: 's6', name: 'Milano Porta Romana', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'basic', status: 'offline', isActive: false, dailyRevenue: 0, totalWashes: 450, location: 'Viale Lodi 8, Milano' },
  { id: 's7', name: 'Milano Sempione', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'premium', status: 'online', isActive: true, dailyRevenue: 155, totalWashes: 1350, location: 'Corso Sempione 55, Milano' },
  { id: 's8', name: 'Milano CityLife', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 195, totalWashes: 980, location: 'Piazza Tre Torri 1, Milano' },
  { id: 's9', name: 'Napoli Centro', clientId: '3', clientName: 'AquaPet Napoli', type: 'basic', status: 'online', isActive: true, dailyRevenue: 120, totalWashes: 920, location: 'Via Toledo 50, Napoli' },
  { id: 's10', name: 'Napoli Vomero', clientId: '3', clientName: 'AquaPet Napoli', type: 'premium', status: 'online', isActive: true, dailyRevenue: 135, totalWashes: 780, location: 'Via Scarlatti 30, Napoli' },
  { id: 's11', name: 'Torino Lingotto', clientId: '4', clientName: 'CleanPaws Torino', type: 'basic', status: 'offline', isActive: false, dailyRevenue: 0, totalWashes: 320, location: 'Via Nizza 280, Torino' },
  { id: 's12', name: 'Firenze Centro', clientId: '5', clientName: 'BauWash Firenze', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 175, totalWashes: 1650, location: 'Via Calzaiuoli 5, Firenze' },
  { id: 's13', name: 'Firenze Rifredi', clientId: '5', clientName: 'BauWash Firenze', type: 'premium', status: 'online', isActive: true, dailyRevenue: 140, totalWashes: 1100, location: 'Viale Redi 10, Firenze' },
  { id: 's14', name: 'Firenze Campo Marte', clientId: '5', clientName: 'BauWash Firenze', type: 'basic', status: 'online', isActive: true, dailyRevenue: 95, totalWashes: 680, location: 'Viale dei Mille 20, Firenze' },
  { id: 's15', name: 'Firenze Isolotto', clientId: '5', clientName: 'BauWash Firenze', type: 'premium', status: 'maintenance', isActive: false, dailyRevenue: 0, totalWashes: 410, location: 'Via Pisana 100, Firenze' },
];

export const revenueData: RevenueData[] = [
  { month: 'Gen', revenue: 4200, washes: 350 },
  { month: 'Feb', revenue: 3800, washes: 310 },
  { month: 'Mar', revenue: 5100, washes: 420 },
  { month: 'Apr', revenue: 5800, washes: 480 },
  { month: 'Mag', revenue: 6200, washes: 510 },
  { month: 'Giu', revenue: 7400, washes: 620 },
  { month: 'Lug', revenue: 8100, washes: 680 },
  { month: 'Ago', revenue: 7200, washes: 590 },
  { month: 'Set', revenue: 6800, washes: 560 },
  { month: 'Ott', revenue: 5900, washes: 490 },
  { month: 'Nov', revenue: 5200, washes: 430 },
  { month: 'Dic', revenue: 4600, washes: 380 },
];

export const discountCodes: DiscountCode[] = [
  { id: 'd1', code: 'WELCOME20', discount: 20, type: 'percentage', usageCount: 45, maxUsage: 100, expiresAt: '2026-06-30', isActive: true },
  { id: 'd2', code: 'SUMMER10', discount: 10, type: 'percentage', usageCount: 120, maxUsage: 200, expiresAt: '2026-09-01', isActive: true },
  { id: 'd3', code: 'FIDO5EUR', discount: 5, type: 'fixed', usageCount: 30, maxUsage: 50, expiresAt: '2026-03-31', isActive: false },
];

export const stationLogs = [
  { timestamp: '2026-02-08 14:32', event: 'Lavaggio completato', type: 'success' as const },
  { timestamp: '2026-02-08 14:15', event: 'Lavaggio avviato - Programma Deluxe', type: 'info' as const },
  { timestamp: '2026-02-08 13:50', event: 'Pagamento ricevuto - €8.50', type: 'success' as const },
  { timestamp: '2026-02-08 12:20', event: 'Manutenzione completata', type: 'warning' as const },
  { timestamp: '2026-02-08 11:00', event: 'Livello sapone basso', type: 'warning' as const },
  { timestamp: '2026-02-08 10:30', event: 'Lavaggio completato', type: 'success' as const },
  { timestamp: '2026-02-08 09:45', event: 'Stazione accesa', type: 'info' as const },
];
