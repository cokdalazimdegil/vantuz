/**
 * 📊 HIZLI DURUM RAPORU
 * Emoji bazlı özet raporlar
 */

import { platformHub } from '../platforms/index.js';

export const quickReportTool = {
    name: 'quick-report',

    async execute(params, context) {
        const { type = 'overview' } = params;

        switch (type) {
            case 'overview':
            case 'ozet':
                return await this.generateOverview(context);

            case 'stock':
            case 'stok':
                return await this.generateStockReport(context);

            case 'orders':
            case 'siparis':
                return await this.generateOrderReport(context);

            case 'platforms':
            case 'platformlar':
                return this.generatePlatformStatus();

            default:
                return { success: false, error: 'Bilinmeyen rapor tipi' };
        }
    },

    async generateOverview(context) {
        const connected = platformHub.getConnected();

        let report = '📊 **Günlük Özet**\n\n';

        // Platform durumu
        report += '🏪 **Platformlar**\n';
        for (const platform of connected) {
            report += `  ${platformHub.getIcon(platform)} ${platform}: ✅ Bağlı\n`;
        }
        report += '\n';

        // Özet metrikler (placeholder - gerçek veriler API'den çekilmeli)
        report += '📈 **Bugün**\n';
        report += '  • Sipariş: 0 yeni\n';
        report += '  • Ciro: ₺0\n';
        report += '  • Stok Uyarı: 0 ürün\n';
        report += '\n';

        report += '💡 *Detay için: /rapor 7d*';

        return {
            success: true,
            report,
            raw: { connectedPlatforms: connected }
        };
    },

    async generateStockReport(context) {
        const connected = platformHub.getConnected();

        let report = '📦 **Stok Durumu**\n\n';

        // Her platform için stok özeti
        for (const platform of connected) {
            const api = platformHub.resolve(platform);
            if (!api) continue;

            try {
                const result = await api.getProducts({ page: 0, size: 100 });
                if (result.success) {
                    const products = result.data.content || result.data.products || result.data || [];

                    const outOfStock = products.filter(p => (p.quantity || p.stock || 0) <= 0);
                    const lowStock = products.filter(p => {
                        const q = p.quantity || p.stock || 0;
                        return q > 0 && q <= 10;
                    });

                    report += `${platformHub.getIcon(platform)} **${platform}**\n`;
                    report += `  📦 Toplam: ${products.length}\n`;
                    report += `  🔴 Stok dışı: ${outOfStock.length}\n`;
                    report += `  🟡 Düşük (≤10): ${lowStock.length}\n`;
                    report += '\n';
                }
            } catch (e) {
                report += `${platformHub.getIcon(platform)} **${platform}**: ⚠️ Hata\n`;
            }
        }

        return { success: true, report };
    },

    async generateOrderReport(context) {
        const connected = platformHub.getConnected();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let report = '🛒 **Sipariş Durumu**\n\n';
        let totalOrders = 0;

        for (const platform of connected) {
            const api = platformHub.resolve(platform);
            if (!api) continue;

            try {
                const result = await api.getOrders({
                    startDate: today.toISOString(),
                    size: 100
                });

                if (result.success) {
                    const orders = result.data.content || result.data.orders || result.data || [];
                    totalOrders += orders.length;

                    const pending = orders.filter(o =>
                        ['created', 'new', 'pending', 'yeni'].some(s =>
                            o.status?.toLowerCase()?.includes(s)
                        )
                    );

                    report += `${platformHub.getIcon(platform)} **${platform}**\n`;
                    report += `  📋 Bugün: ${orders.length}\n`;
                    report += `  ⏳ Bekleyen: ${pending.length}\n`;
                    report += '\n';
                }
            } catch (e) {
                report += `${platformHub.getIcon(platform)} **${platform}**: ⚠️ Hata\n`;
            }
        }

        report += `📊 **Toplam**: ${totalOrders} sipariş`;

        return { success: true, report };
    },

    generatePlatformStatus() {
        const status = platformHub.getStatus();

        let report = '🔌 **Platform Bağlantıları**\n\n';

        for (const [name, info] of Object.entries(status)) {
            const statusIcon = info.connected ? '✅' : '⭕';
            const statusText = info.connected ? 'Bağlı' : 'Bağlı değil';
            report += `${info.icon} ${name}: ${statusIcon} ${statusText}\n`;
        }

        const connectedCount = Object.values(status).filter(s => s.connected).length;
        report += `\n📊 ${connectedCount}/${Object.keys(status).length} platform aktif`;

        return { success: true, report };
    }
};

/**
 * Kolay erişim fonksiyonları
 */
export async function dailyOverview(context) {
    return await quickReportTool.execute({ type: 'overview' }, context);
}

export async function stockStatus(context) {
    return await quickReportTool.execute({ type: 'stock' }, context);
}

export async function orderStatus(context) {
    return await quickReportTool.execute({ type: 'orders' }, context);
}

export default quickReportTool;
