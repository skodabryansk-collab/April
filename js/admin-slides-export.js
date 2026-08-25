(() => {
    const button = document.getElementById('exportSlidesBtn');
    if (!button) return;

    const getPptxConstructor = () => window.PptxGenJS || window.pptxgen;

    const waitForExportLibraries = () => new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const check = () => {
            const PptxConstructor = getPptxConstructor();
            if (window.html2canvas && PptxConstructor) return resolve(PptxConstructor);
            if (Date.now() - startedAt >= 10000) {
                return reject(new Error('Не удалось загрузить библиотеки экспорта. Проверьте подключение к интернету и повторите попытку.'));
            }
            window.setTimeout(check, 100);
        };
        check();
    });

    const getMonthLabel = () => {
        const value = document.getElementById('monthSelector')?.value || '';
        const [year, month] = value.split('-').map(Number);
        if (!year || !month) return value;
        return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
    };

    const ensureExportStyles = () => {
        if (document.getElementById('pptx-export-styles')) return;
        const style = document.createElement('style');
        style.id = 'pptx-export-styles';
        style.textContent = `
            .pptx-export-surface { align-items: stretch; align-content: stretch; }
            .pptx-export-surface > .card,
            .pptx-export-surface > .total-gk-card {
                width: 100% !important;
                min-width: 0 !important;
                min-height: 0 !important;
                height: 100% !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                padding: 13px !important;
                border-radius: 10px !important;
                box-shadow: none !important;
            }
            .pptx-export-surface > .card h2 { margin-bottom: 9px !important; padding-bottom: 7px !important; font-size: 16px !important; }
            .pptx-export-surface > .card .metric-section { margin-bottom: 7px !important; padding-bottom: 6px !important; }
            .pptx-export-surface > .card .metric-section + .metric-section { padding-top: 1px !important; }
            .pptx-export-surface > .card .metric-header { margin-bottom: 4px !important; }
            .pptx-export-surface > .card .metric-title,
            .pptx-export-surface > .card .fact-percent { font-size: 11px !important; }
            .pptx-export-surface > .card .forecast-badge { padding: 2px 4px !important; font-size: 8px !important; }
            .pptx-export-surface > .card .progress-bar { height: 24px !important; margin-bottom: 2px !important; }
            .pptx-export-surface > .card .progress-labels { margin-top: 2px !important; min-height: 12px !important; font-size: 9px !important; }
            .pptx-export-surface > .card .metric-details { gap: 4px !important; margin-top: 4px !important; }
            .pptx-export-surface > .card .detail-item { padding: 3px 5px !important; font-size: 9px !important; }
            .pptx-export-surface > .card > div:last-child { margin-top: 8px !important; padding-top: 8px !important; }
        `;
        document.head.appendChild(style);
    };

    const buildExportSurface = (children, columns, height) => {
        ensureExportStyles();
        const surface = document.createElement('div');
        surface.className = 'pptx-export-surface';
        surface.style.cssText = `position:fixed;left:-10000px;top:0;width:1280px;height:${height}px;box-sizing:border-box;padding:26px 30px;background:#fff;color:#344054;display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));grid-template-rows:repeat(${Math.ceil(children.length / columns)},minmax(0,1fr));gap:14px;z-index:-1;`;
        children.forEach(child => surface.appendChild(child.cloneNode(true)));
        document.body.appendChild(surface);
        return surface;
    };

    const addCapturedSlide = async (pptx, surface, title) => {
        const canvas = await window.html2canvas(surface, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const image = canvas.toDataURL('image/png');
        const slide = pptx.addSlide();
        slide.background = { color: 'F5F7FA' };
        slide.addText(title, { x: 0.45, y: 0.18, w: 12.4, h: 0.26, fontFace: 'Arial', fontSize: 11, bold: true, color: '344054', margin: 0 });
        const maxW = 12.65;
        const maxH = 6.72;
        const surfaceWidth = surface.getBoundingClientRect().width;
        const surfaceHeight = surface.getBoundingClientRect().height;
        const ratio = Math.min(maxW / surfaceWidth, maxH / surfaceHeight);
        const width = surfaceWidth * ratio;
        const height = surfaceHeight * ratio;
        slide.addImage({ data: image, x: (13.333 - width) / 2, y: 0.58, w: width, h: height });
    };

    const exportPresentation = async () => {
        const PptxConstructor = await waitForExportLibraries();
        const gk = document.querySelector('#totalGKContainer .total-gk-card');
        const brands = [...document.querySelectorAll('#dashboard > .card')];
        if (!gk || !brands.length) throw new Error('Сначала рассчитайте данные дашборда');

        const pptx = new PptxConstructor();
        pptx.layout = 'LAYOUT_WIDE';
        pptx.author = 'Дебрянск Авто';
        pptx.subject = 'Ежедневный отчёт по продажам';
        pptx.title = `Отчёт по продажам — ${getMonthLabel()}`;
        pptx.company = 'Дебрянск Авто';

        const surfaces = [];
        try {
            const gkSurface = buildExportSurface([gk], 1, 700);
            surfaces.push(gkSurface);
            await addCapturedSlide(pptx, gkSurface, `Итого по ГК · ${getMonthLabel()}`);

            for (let start = 0, slideNumber = 2; start < brands.length; start += 4, slideNumber++) {
                const page = buildExportSurface(brands.slice(start, start + 4), 4, 700);
                surfaces.push(page);
                await addCapturedSlide(pptx, page, `Бренды · ${getMonthLabel()} · ${slideNumber}`);
            }
        } finally {
            surfaces.forEach(surface => surface.remove());
        }

        const safeMonth = (document.getElementById('monthSelector')?.value || 'отчёт').replace(/[^0-9-]/g, '');
        await pptx.writeFile({ fileName: `отчёт-дебрянск-авто-${safeMonth}.pptx` });
    };

    button.addEventListener('click', async () => {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Формирую PPTX…';
        try {
            await exportPresentation();
            window.dashboardCore?.uiManager?.showNotification('Презентация из 3 слайдов скачана', 'success');
        } catch (error) {
            console.error('❌ Ошибка экспорта PPTX:', error);
            window.dashboardCore?.uiManager?.showNotification(error.message || 'Не удалось сформировать презентацию', 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
})();