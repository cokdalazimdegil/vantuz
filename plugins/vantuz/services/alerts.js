/**
 * 🔔 AKILLI UYARI SİSTEMİ
 * Stok, fiyat ve sipariş uyarıları
 */

const DEFAULT_THRESHOLDS = {
    criticalStock: 5,      // Kritik stok seviyesi
    lowStock: 20,          // Düşük stok uyarısı
    priceDropPercent: 10,  // Rakip fiyat düşüşü uyarısı
    orderDelay: 24,        // Sipariş gecikme saati
    reviewNegative: 3      // Negatif yorum eşiği
};

export class AlertService {
    constructor(config = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
        this.subscribers = [];
        this.alerts = [];
        this.notifiedToday = new Set(); // Aynı uyarıyı tekrar gönderme
    }

    /**
     * Uyarı ekle
     */
    addAlert(alert) {
        const key = `${alert.type}-${alert.productId || alert.orderId || 'general'}`;

        // Bugün zaten bildirildi mi?
        if (this.notifiedToday.has(key)) {
            return false;
        }

        this.alerts.push({
            ...alert,
            id: `alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            read: false
        });

        this.notifiedToday.add(key);
        return true;
    }

    /**
     * Stok kontrolü
     */
    async checkStock(products, platform) {
        const alerts = [];

        for (const product of products) {
            const stock = product.quantity || product.stock || product.availableStock || 0;
            const name = product.title || product.name || product.barcode;

            if (stock <= 0) {
                alerts.push({
                    type: 'stock_out',
                    severity: 'critical',
                    icon: '🔴',
                    message: `Stok bitti: ${name}`,
                    productId: product.barcode || product.id,
                    platform,
                    value: stock
                });
            } else if (stock <= this.thresholds.criticalStock) {
                alerts.push({
                    type: 'stock_critical',
                    severity: 'high',
                    icon: '🟠',
                    message: `Kritik stok (${stock}): ${name}`,
                    productId: product.barcode || product.id,
                    platform,
                    value: stock
                });
            } else if (stock <= this.thresholds.lowStock) {
                alerts.push({
                    type: 'stock_low',
                    severity: 'medium',
                    icon: '🟡',
                    message: `Düşük stok (${stock}): ${name}`,
                    productId: product.barcode || product.id,
                    platform,
                    value: stock
                });
            }
        }

        alerts.forEach(a => this.addAlert(a));
        return alerts;
    }

    /**
     * Rakip fiyat kontrolü
     */
    async checkCompetitorPrices(comparisons) {
        const alerts = [];

        for (const comp of comparisons) {
            const { product, ourPrice, lowestCompetitor, competitorName } = comp;
            const diff = ((ourPrice - lowestCompetitor) / ourPrice) * 100;

            if (lowestCompetitor < ourPrice && diff > this.thresholds.priceDropPercent) {
                alerts.push({
                    type: 'competitor_undercut',
                    severity: 'high',
                    icon: '💸',
                    message: `Rakip ${Math.round(diff)}% ucuz: ${product.name || product.barcode}`,
                    productId: product.barcode,
                    competitor: competitorName,
                    ourPrice,
                    competitorPrice: lowestCompetitor,
                    suggestion: `Fiyatı ${lowestCompetitor * 0.99}₺'ye düşürmeyi düşünün`
                });
            }
        }

        alerts.forEach(a => this.addAlert(a));
        return alerts;
    }

    /**
     * Sipariş gecikme kontrolü
     */
    async checkOrderDelays(orders) {
        const alerts = [];
        const now = Date.now();

        for (const order of orders) {
            const createdAt = new Date(order.createdDate || order.orderDate).getTime();
            const hoursAgo = (now - createdAt) / (1000 * 60 * 60);

            const status = order.status?.toLowerCase();
            const isPending = ['created', 'new', 'pending', 'yeni'].some(s => status?.includes(s));

            if (isPending && hoursAgo > this.thresholds.orderDelay) {
                alerts.push({
                    type: 'order_delayed',
                    severity: 'high',
                    icon: '⏰',
                    message: `${Math.round(hoursAgo)} saat bekleyen sipariş: #${order.orderNumber || order.id}`,
                    orderId: order.id,
                    hoursDelayed: Math.round(hoursAgo),
                    suggestion: 'Siparişi hazırlayın veya iptal edin'
                });
            }
        }

        alerts.forEach(a => this.addAlert(a));
        return alerts;
    }

    /**
     * Tüm uyarıları formatla
     */
    formatAlerts(alerts) {
        if (alerts.length === 0) {
            return '✅ Herhangi bir uyarı yok!';
        }

        const grouped = {
            critical: alerts.filter(a => a.severity === 'critical'),
            high: alerts.filter(a => a.severity === 'high'),
            medium: alerts.filter(a => a.severity === 'medium'),
            low: alerts.filter(a => a.severity === 'low')
        };

        let message = '📋 **Uyarı Özeti**\n\n';

        if (grouped.critical.length > 0) {
            message += `🔴 **Kritik (${grouped.critical.length})**\n`;
            grouped.critical.forEach(a => {
                message += `  • ${a.message}\n`;
            });
            message += '\n';
        }

        if (grouped.high.length > 0) {
            message += `🟠 **Yüksek (${grouped.high.length})**\n`;
            grouped.high.slice(0, 5).forEach(a => {
                message += `  • ${a.message}\n`;
            });
            if (grouped.high.length > 5) {
                message += `  ... ve ${grouped.high.length - 5} uyarı daha\n`;
            }
            message += '\n';
        }

        if (grouped.medium.length > 0) {
            message += `🟡 **Orta (${grouped.medium.length})**\n`;
            grouped.medium.slice(0, 3).forEach(a => {
                message += `  • ${a.message}\n`;
            });
            if (grouped.medium.length > 3) {
                message += `  ... ve ${grouped.medium.length - 3} uyarı daha\n`;
            }
        }

        return message;
    }

    /**
     * Okunmamış uyarı sayısı
     */
    getUnreadCount() {
        return this.alerts.filter(a => !a.read).length;
    }

    /**
     * Uyarıları okundu işaretle
     */
    markAllRead() {
        this.alerts.forEach(a => a.read = true);
    }

    /**
     * Günlük cache'i temizle
     */
    resetDaily() {
        this.notifiedToday.clear();
    }
}

export const alertTool = {
    name: 'alert',

    async execute(params, context) {
        const { action, type } = params;
        const alertService = new AlertService();

        switch (action) {
            case 'check':
                // Tüm kontrolleri yap ve uyarıları topla
                const allAlerts = [];
                // TODO: Platform API'lerinden veri çek ve kontrol et
                return { success: true, alerts: allAlerts };

            case 'list':
                return {
                    success: true,
                    alerts: alertService.alerts,
                    unread: alertService.getUnreadCount()
                };

            case 'clear':
                alertService.markAllRead();
                return { success: true };

            default:
                return { success: false, error: 'Geçersiz action' };
        }
    }
};

export default AlertService;
