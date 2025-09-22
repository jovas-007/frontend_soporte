import { Component, OnInit } from '@angular/core';
import { EstadisticasService, PersonajeStats } from '../../services/estadisticas.service';
import { ChartConfiguration, Plugin } from 'chart.js';

type PersonajeRow = PersonajeStats & { imagen_src?: string; imagen?: string };

@Component({
  selector: 'app-estadisticas-screen',
  templateUrl: './estadisticas-screen.component.html',
  styleUrls: ['./estadisticas-screen.component.scss']
})
export class EstadisticasScreenComponent implements OnInit {
  isLoading = true;

  estadisticas: Record<string, PersonajeStats[]> = {};
  afiliaciones: string[] = [];

  chartData: Record<string, ChartConfiguration<'bar'>['data']> = {};
  chartOptionsByAf: Record<string, NonNullable<ChartConfiguration<'bar'>['options']>> = {};

  chartHeight = 420;
  private placeholder = 'assets/placeholder-dbz.png';

  private nf = new Intl.NumberFormat('es-MX');
  private nfCompact = new Intl.NumberFormat('es-MX', { notation: 'compact' });

  constructor(private statsService: EstadisticasService) {}

  ngOnInit(): void {
    this.statsService.getEstadisticas().subscribe({
      next: (data) => {
        this.estadisticas = data;
        this.afiliaciones = Object.keys(data);

        // Colores para Total KI
        const totalOrange   = this.tryRgba('--dbz-orange-500-rgb', 0.82, 'rgba(245,158,11,0.82)');
        const totalOrangeBd = this.tryRgba('--dbz-orange-500-rgb', 1,    'rgba(245,158,11,1)');

        for (const af of this.afiliaciones) {
          const personajes = (data[af] ?? []) as PersonajeRow[];

          const labels = personajes.map(p => this.truncate(p.nombre, 14));
          const imgs   = personajes.map(p => p.imagen_src || p.imagen || this.placeholder);

          // SOLO Total KI
          const d: ChartConfiguration<'bar'>['data'] = {
            labels,
            datasets: [
              {
                label: 'Total KI',
                data: personajes.map(p => p.total_ki),
                backgroundColor: totalOrange,
                borderColor: totalOrangeBd,
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 46,
                maxBarThickness: 52,
                categoryPercentage: 0.78,
                barPercentage: 0.72
              }
            ]
          };

          // Guarda imágenes en el objeto data por si no vienen en las options
          (d as any)._tickImages = imgs;

          this.chartData[af] = d;

          // Opciones base y plugin personalizados
          const baseOpts = this.buildBaseOptions();

          this.chartOptionsByAf[af] = {
            ...baseOpts,
            plugins: {
              ...(baseOpts.plugins ?? {}),
              legend: { display: false },
              // Plugin que dibuja nombre + imagen (labels más grandes y negros)
              ...( {
                imageTicks: {
                  images: imgs,
                  labels,
                  size: 30,
                  yOffset: 30,
                  labelColor: '#36393fff', // negro
                  font: '700 13px Inter, Roboto, "Helvetica Neue", Arial'
                }
              } as any )
            } as any
          };
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al obtener estadísticas:', err);
        this.isLoading = false;
      }
    });
  }

  /** Plugin: oculta las etiquetas nativas y dibuja nombre + miniatura en el eje X */
  imageTickPlugin: Plugin<'bar'> = {
    id: 'imageTicks',
    afterDraw: (chart, _args, opts: any) => {
      const { ctx, chartArea, scales } = chart;
      const xScale: any = (scales as any).x;
      if (!xScale) return;

      // Primer intento: tomar imágenes de opciones
      let imgUrls: string[] | undefined = opts?.images;
      // Si no hay imágenes en options, tomar las que guardamos en data
      if (!imgUrls || !imgUrls.length) {
        imgUrls = (chart.data as any)?._tickImages as string[] | undefined;
      }
      const labels: string[] = opts?.labels || (chart.data.labels as string[]);

      if (!imgUrls?.length) return;

      const size = opts?.size ?? 30;
      const half = size / 2;
      const yImg = chartArea.bottom + (opts?.yOffset ?? 30);
      const labelColor = opts?.labelColor || '#111827';
      const font = opts?.font || '700 13px Inter, Roboto, "Helvetica Neue", Arial';

      (opts._cache ||= []);

      xScale.ticks.forEach((_tick: any, i: number) => {
        const x = xScale.getPixelForTick(i);

        // Dibuja el nombre encima de la imagen
        const name = labels?.[i] ?? '';
        if (name) {
          ctx.save();
          ctx.font = font;
          ctx.fillStyle = labelColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(name, x, yImg - half - 6);
          ctx.restore();
        }

        // Dibuja la imagen circular debajo del nombre
        const src = imgUrls![i] || this.placeholder;
        if (!src) return;

        let img: HTMLImageElement = opts._cache[i];
        if (!img || img.src !== src) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = src;
          opts._cache[i] = img;
          img.onload = () => chart.draw();
        }
        if (!img.complete) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, yImg, half, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, x - half, yImg - half, size, size);
        ctx.restore();

        // Borde sutil
        ctx.beginPath();
        ctx.arc(x, yImg, half, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  };

  /** Opciones base: oculta etiquetas nativas de X y aumenta el padding inferior */
  private buildBaseOptions(): NonNullable<ChartConfiguration<'bar'>['options']> {
    const text  = this.cssVar('--dbz-text')  || '#1f2937';
    const muted = this.cssVar('--dbz-muted') || '#64748b';
    const grid  = this.cssVar('--dbz-grid')  || 'rgba(0,0,0,.06)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 12, bottom: 86, left: 4 } },
      scales: {
        x: {
          ticks: {
            display: false,
            maxRotation: 0,
            minRotation: 0,
          },
          grid: { display: false },
          border: { display: false }
        },
        y: {
          ticks: {
            color: muted,
            font: { size: 12, family: 'Inter, Roboto, "Helvetica Neue", Arial' },
            callback: (v) => this.nfCompact.format(Number(v))
          },
          grid: { color: grid },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,.95)',
          titleColor: text,
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(148,163,184,.25)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => `${this.nf.format(ctx.parsed.y)}`
          }
        }
      },
      animation: { duration: 350, easing: 'easeOutQuart' }
    };
  }

  // ===== Helpers =====
  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private tryRgba(rgbVar: string, a: number, fallback: string): string {
    const val = this.cssVar(rgbVar);
    return val ? `rgba(${val}, ${a})` : fallback;
  }

  private truncate(text: string, max = 14): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }
}
