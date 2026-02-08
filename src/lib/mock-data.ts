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
  type: 'barboncino' | 'bracco' | 'deluxe';
  status: 'online' | 'offline' | 'maintenance';
  isActive: boolean;
  dailyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalWashes: number;
  location: string;
  price: number;
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

export interface MaintenanceLog {
  id: string;
  stationId: string;
  stationName: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export const clients: Client[] = [
  { id: '1', name: 'PetShop Roma', email: 'info@petshoproma.it', phone: '+39 06 1234567', stations: 3, totalRevenue: 12450, status: 'active', joinDate: '2024-03-15' },
  { id: '2', name: 'Lavaggio Fido Milano', email: 'fido@milano.it', phone: '+39 02 9876543', stations: 5, totalRevenue: 28300, status: 'active', joinDate: '2023-11-20' },
  { id: '3', name: 'AquaPet Napoli', email: 'aqua@napoli.it', phone: '+39 081 5551234', stations: 2, totalRevenue: 8900, status: 'active', joinDate: '2024-06-01' },
  { id: '4', name: 'CleanPaws Torino', email: 'clean@torino.it', phone: '+39 011 4445566', stations: 1, totalRevenue: 3200, status: 'inactive', joinDate: '2024-01-10' },
  { id: '5', name: 'BauWash Firenze', email: 'bau@firenze.it', phone: '+39 055 7778899', stations: 4, totalRevenue: 19750, status: 'active', joinDate: '2023-09-05' },
];

export const stations: Station[] = [
  { id: 's1', name: 'Stazione Roma Centro', clientId: '1', clientName: 'PetShop Roma', type: 'bracco', status: 'online', isActive: true, dailyRevenue: 145, monthlyRevenue: 4350, totalRevenue: 34800, totalWashes: 1230, location: 'Via Roma 15, Roma', price: 8.50 },
  { id: 's2', name: 'Stazione Roma Nord', clientId: '1', clientName: 'PetShop Roma', type: 'barboncino', status: 'online', isActive: true, dailyRevenue: 98, monthlyRevenue: 2940, totalRevenue: 23520, totalWashes: 870, location: 'Via Flaminia 200, Roma', price: 6.00 },
  { id: 's3', name: 'Stazione Roma EUR', clientId: '1', clientName: 'PetShop Roma', type: 'deluxe', status: 'maintenance', isActive: false, dailyRevenue: 0, monthlyRevenue: 0, totalRevenue: 15680, totalWashes: 560, location: 'Viale Europa 100, Roma', price: 12.00 },
  { id: 's4', name: 'Milano Centrale', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'bracco', status: 'online', isActive: true, dailyRevenue: 210, monthlyRevenue: 6300, totalRevenue: 50400, totalWashes: 2100, location: 'Corso Buenos Aires 44, Milano', price: 8.50 },
  { id: 's5', name: 'Milano Navigli', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 180, monthlyRevenue: 5400, totalRevenue: 43200, totalWashes: 1800, location: 'Alzaia Naviglio 12, Milano', price: 12.00 },
  { id: 's6', name: 'Milano Porta Romana', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'barboncino', status: 'offline', isActive: false, dailyRevenue: 0, monthlyRevenue: 0, totalRevenue: 9000, totalWashes: 450, location: 'Viale Lodi 8, Milano', price: 6.00 },
  { id: 's7', name: 'Milano Sempione', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'bracco', status: 'online', isActive: true, dailyRevenue: 155, monthlyRevenue: 4650, totalRevenue: 37200, totalWashes: 1350, location: 'Corso Sempione 55, Milano', price: 8.50 },
  { id: 's8', name: 'Milano CityLife', clientId: '2', clientName: 'Lavaggio Fido Milano', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 195, monthlyRevenue: 5850, totalRevenue: 23400, totalWashes: 980, location: 'Piazza Tre Torri 1, Milano', price: 12.00 },
  { id: 's9', name: 'Napoli Centro', clientId: '3', clientName: 'AquaPet Napoli', type: 'barboncino', status: 'online', isActive: true, dailyRevenue: 120, monthlyRevenue: 3600, totalRevenue: 28800, totalWashes: 920, location: 'Via Toledo 50, Napoli', price: 6.00 },
  { id: 's10', name: 'Napoli Vomero', clientId: '3', clientName: 'AquaPet Napoli', type: 'bracco', status: 'online', isActive: true, dailyRevenue: 135, monthlyRevenue: 4050, totalRevenue: 24300, totalWashes: 780, location: 'Via Scarlatti 30, Napoli', price: 8.50 },
  { id: 's11', name: 'Torino Lingotto', clientId: '4', clientName: 'CleanPaws Torino', type: 'barboncino', status: 'offline', isActive: false, dailyRevenue: 0, monthlyRevenue: 0, totalRevenue: 6400, totalWashes: 320, location: 'Via Nizza 280, Torino', price: 6.00 },
  { id: 's12', name: 'Firenze Centro', clientId: '5', clientName: 'BauWash Firenze', type: 'deluxe', status: 'online', isActive: true, dailyRevenue: 175, monthlyRevenue: 5250, totalRevenue: 49500, totalWashes: 1650, location: 'Via Calzaiuoli 5, Firenze', price: 12.00 },
  { id: 's13', name: 'Firenze Rifredi', clientId: '5', clientName: 'BauWash Firenze', type: 'bracco', status: 'online', isActive: true, dailyRevenue: 140, monthlyRevenue: 4200, totalRevenue: 33000, totalWashes: 1100, location: 'Viale Redi 10, Firenze', price: 8.50 },
  { id: 's14', name: 'Firenze Campo Marte', clientId: '5', clientName: 'BauWash Firenze', type: 'barboncino', status: 'online', isActive: true, dailyRevenue: 95, monthlyRevenue: 2850, totalRevenue: 17000, totalWashes: 680, location: 'Viale dei Mille 20, Firenze', price: 6.00 },
  { id: 's15', name: 'Firenze Isolotto', clientId: '5', clientName: 'BauWash Firenze', type: 'bracco', status: 'maintenance', isActive: false, dailyRevenue: 0, monthlyRevenue: 0, totalRevenue: 10250, totalWashes: 410, location: 'Via Pisana 100, Firenze', price: 8.50 },
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

export const maintenanceLogs: MaintenanceLog[] = [
  { id: 'm1', stationId: 's3', stationName: 'Stazione Roma EUR', timestamp: '2026-02-08 14:00', level: 'error', message: 'Pompa acqua bloccata - intervento richiesto' },
  { id: 'm2', stationId: 's6', stationName: 'Milano Porta Romana', timestamp: '2026-02-08 13:30', level: 'error', message: 'Sensore temperatura fuori range' },
  { id: 'm3', stationId: 's15', stationName: 'Firenze Isolotto', timestamp: '2026-02-08 12:15', level: 'warning', message: 'Livello sapone sotto il 10%' },
  { id: 'm4', stationId: 's1', stationName: 'Stazione Roma Centro', timestamp: '2026-02-08 11:45', level: 'info', message: 'Manutenzione programmata completata' },
  { id: 'm5', stationId: 's4', stationName: 'Milano Centrale', timestamp: '2026-02-08 10:00', level: 'warning', message: 'Filtro acqua da sostituire entro 7 giorni' },
  { id: 'm6', stationId: 's11', stationName: 'Torino Lingotto', timestamp: '2026-02-07 18:30', level: 'error', message: 'Connessione persa - stazione offline' },
  { id: 'm7', stationId: 's9', stationName: 'Napoli Centro', timestamp: '2026-02-07 16:20', level: 'info', message: 'Aggiornamento firmware completato v2.4.1' },
  { id: 'm8', stationId: 's12', stationName: 'Firenze Centro', timestamp: '2026-02-07 14:10', level: 'warning', message: 'Pressione acqua instabile' },
  { id: 'm9', stationId: 's5', stationName: 'Milano Navigli', timestamp: '2026-02-07 09:00', level: 'info', message: 'Sostituzione filtro completata' },
  { id: 'm10', stationId: 's2', stationName: 'Stazione Roma Nord', timestamp: '2026-02-06 17:45', level: 'warning', message: 'Consumo energetico elevato rilevato' },
];
