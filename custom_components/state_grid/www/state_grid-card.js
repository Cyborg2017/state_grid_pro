console.info(
  "%c 国家电网卡片 \n%c        v0.9 ",
  "color: #00A651; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: black"
);
import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// 分时电量颜色：尖/峰/平/谷
const TIER_COLORS = {
  t: "#EF5350", // 尖 - 红
  p: "#FF9800", // 峰 - 橙
  n: "#42A5F5", // 平 - 蓝
  v: "#66BB6A", // 谷 - 绿
};
const TIER_NAMES = { t: "尖", p: "峰", n: "平", v: "谷" };

// 集成创建的所有实体都以 sensor.state_grid_<户号>_<key> 命名，key 取值如下
const KNOWN_KEYS = [
  "recent_30_daily_ele_list",
  "recent_12_monthly_ele_list",
  "balance",
  "esti_amt",
  "history_owe",
  "year_ele_num",
  "year_ele_cost",
  "year_p_ele_num",
  "year_v_ele_num",
  "year_n_ele_num",
  "year_t_ele_num",
  "last_month_ele_num",
  "last_month_ele_cost",
  "last_month_meter_num",
  "month_ele_num",
  "month_p_ele_num",
  "month_v_ele_num",
  "month_n_ele_num",
  "month_t_ele_num",
  "daily_ele_num",
  "daily_p_ele_num",
  "daily_v_ele_num",
  "daily_n_ele_num",
  "daily_t_ele_num",
  "daily_lasted_date",
  "refresh_time",
];

/* ============================ 编辑器 ============================ */
class StateGridCardEditor extends LitElement {
  static get properties() {
    return { hass: { type: Object }, _config: { type: Object } };
  }

  static get styles() {
    return css`
      .form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }
      label {
        font-weight: bold;
        font-size: 14px;
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .check {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        font-weight: normal;
      }
      select,
      input {
        padding: 8px 12px;
        border: 1px solid var(--primary-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      }
      .hint {
        font-size: 12px;
        font-weight: normal;
        color: var(--secondary-text-color, #999);
      }
    `;
  }

  setConfig(config) {
    this._config = config;
  }

  render() {
    if (!this.hass) return html``;
    const config = this._config || {};
    const entities = Object.keys(this.hass.states)
      .filter(
        (e) =>
          e.startsWith("sensor.state_grid_") &&
          e.endsWith("recent_30_daily_ele_list")
      )
      .sort();

    return html`
      <div class="form">
        <label>
          实体（选择"最近30天每日用电"图表实体）：
          <select @change=${(e) => this._valueChanged("entity", e.target.value)}>
            <option value="">-- 选择实体 --</option>
            ${entities.map(
              (e) =>
                html`<option value="${e}" ?selected=${config.entity === e}>
                  ${e}
                </option>`
            )}
          </select>
        </label>
        <label>
          标题：
          <input
            type="text"
            .value=${config.title || "国家电网"}
            @change=${(e) => this._valueChanged("title", e.target.value)}
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            ?checked=${config.show_monthly !== false}
            @change=${(e) => this._valueChanged("show_monthly", e.target.checked)}
          />
          显示月度用电趋势
        </label>
        <label class="check">
          <input
            type="checkbox"
            ?checked=${config.show_calendar === true}
            @change=${(e) => this._valueChanged("show_calendar", e.target.checked)}
          />
          默认展开用电日历
        </label>
        <div class="hint">余额、电费、分时用电等信息会自动从同一户号的实体读取。</div>
      </div>
    `;
  }

  _valueChanged(name, value) {
    if (!this._config) return;
    const config = { ...this._config, [name]: value };
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config } })
    );
  }
}
customElements.define("state-grid-card-editor", StateGridCardEditor);

/* ============================ 卡片主体 ============================ */
class StateGridCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _dailyChart: { type: Object },
      _monthlyChart: { type: Object },
      _showMonthly: { type: Boolean },
      _showCalendar: { type: Boolean },
      _showTier: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .card {
        position: relative;
        background: var(--card-background-color, #fff);
        border-radius: var(--border-radius, 12px);
        box-shadow: var(--box-shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
        overflow: hidden;
        font-family: var(--primary-font-family, sans-serif);
        color: var(--primary-text-color, #333);
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 2px solid transparent;
        border-image: linear-gradient(90deg, #00a651, #43a047, #ffc107, transparent) 1;
      }
      .card-title {
        font-size: 18px;
        font-weight: bold;
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .card-logo {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      }
      .card-subtitle {
        font-size: 12px;
        color: var(--secondary-text-color, #999);
        margin-top: 2px;
      }
      .summary-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: 12px 12px;
        gap: 8px;
      }
      .summary-item {
        text-align: center;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.03));
        border-radius: 10px;
        padding: 10px 4px 8px;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .summary-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
      }
      .summary-icon ha-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color, #999);
      }
      .summary-value {
        font-size: 18px;
        font-weight: bold;
        color: var(--primary-text-color);
        line-height: 1.3;
      }
      .summary-value.green {
        color: #00a651;
      }
      .summary-value.blue {
        color: #1e88e5;
      }
      .summary-value.orange {
        color: #ff6d00;
      }
      .summary-value.red {
        color: #ef5350;
      }
      .summary-label {
        font-size: 10px;
        color: var(--secondary-text-color, #999);
        margin-top: 2px;
        line-height: 1.3;
        word-break: keep-all;
      }
      .chart-section {
        padding: 4px 12px 12px;
      }
      .chart-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-text-color);
        padding: 0 4px 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .chart-title ha-icon {
        --mdc-icon-size: 16px;
        color: #00a651;
      }
      .chart-container {
        width: 100%;
      }
      .chart-legend {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 11px;
        color: var(--secondary-text-color, #999);
        padding-bottom: 5px;
      }
      .chart-legend span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .chart-legend i {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        display: inline-block;
      }
      .chart-fallback {
        margin: 4px 8px 8px;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(239, 83, 80, 0.12);
        border-left: 3px solid #ef5350;
        color: var(--secondary-text-color, #999);
        font-size: 12px;
        line-height: 1.5;
      }
      .legend {
        display: flex;
        justify-content: center;
        gap: 14px;
        padding: 2px 0 6px;
        font-size: 11px;
        color: var(--secondary-text-color, #999);
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 9px 20px;
        border-top: 1px solid var(--divider-color, #eee);
        font-size: 13px;
        transition: background 0.15s;
      }
      .info-row:hover {
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.02));
      }
      .info-label {
        color: var(--secondary-text-color, #999);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .info-label ha-icon {
        --mdc-icon-size: 16px;
        color: #00a651;
      }
      .info-value {
        color: var(--primary-text-color);
        font-weight: 500;
      }
      .no-data {
        text-align: center;
        padding: 40px 20px;
        color: var(--secondary-text-color, #999);
        font-size: 14px;
      }
      .toggle-row {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 6px 16px 10px;
      }
      .toggle-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 16px;
        border-radius: 20px;
        border: 1px solid var(--divider-color, #eee);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        user-select: none;
      }
      .toggle-btn:hover {
        background: #00a651;
        color: #fff;
        border-color: #00a651;
      }
      .toggle-btn.active {
        background: #00a651;
        color: #fff;
        border-color: #00a651;
      }
      .toggle-btn ha-icon {
        --mdc-icon-size: 18px;
      }

      /* 分时占比 */
      .tier-section {
        padding: 4px 16px 16px;
      }
      .tier-item {
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.03));
        border-radius: 10px;
        padding: 12px 14px;
        margin-bottom: 10px;
      }
      .tier-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 600;
      }
      .tier-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 6px;
      }
      .tier-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      .tier-info {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--secondary-text-color, #999);
      }
      .tier-tip {
        background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
        border-left: 3px solid #00a651;
        border-radius: 6px;
        padding: 10px 12px;
        margin-top: 4px;
        font-size: 12px;
        color: #1b5e20;
      }

      /* 日历 */
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0;
        padding: 8px 12px 12px;
        margin: 0 8px 8px;
        border-radius: 10px;
        background: var(--card-background-color, #fff);
      }
      .cal-nav-row {
        display: flex;
        align-items: center;
        justify-content: center;
        grid-column: 1 / -1;
        gap: 8px;
        padding: 4px 0 8px;
      }
      .cal-nav-btn {
        cursor: pointer;
        user-select: none;
        font-size: 16px;
        padding: 2px 10px;
        border-radius: 6px;
        transition: background 0.15s;
        color: var(--primary-text-color);
      }
      .cal-nav-btn:hover {
        background: rgba(0, 166, 81, 0.15);
      }
      .cal-nav-btn.disabled {
        opacity: 0.3;
        pointer-events: none;
      }
      .cal-year-month {
        font-size: 15px;
        font-weight: 600;
        min-width: 100px;
        text-align: center;
        color: var(--primary-text-color);
      }
      .cal-today-btn {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        cursor: pointer;
        user-select: none;
        color: #00a651;
        border: 1px solid #00a651;
        transition: all 0.15s;
      }
      .cal-today-btn:hover {
        background: #00a651;
        color: #fff;
      }
      .cal-weekday {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 0;
        color: var(--secondary-text-color, #999);
      }
      .cal-day {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3px 2px;
        min-height: 46px;
        font-size: 11px;
        line-height: 1.3;
        border: 0.5px solid var(--divider-color, rgba(0, 0, 0, 0.06));
      }
      .cal-day-num {
        font-weight: 600;
        font-size: 12px;
        color: var(--primary-text-color);
      }
      .cal-day-usage {
        font-size: 10px;
        color: #00a651;
        font-weight: 500;
      }
      .cal-day.min-usage {
        background: rgba(66, 165, 245, 0.15);
      }
      .cal-day.max-usage {
        background: rgba(239, 83, 80, 0.15);
      }
      .cal-day.today .cal-day-num {
        color: #fff;
        background: #00a651;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        line-height: 20px;
      }
      .cal-day.empty {
        border: none;
        min-height: 0;
      }
      .cal-summary-row {
        grid-column: 1 / -1;
        display: flex;
        justify-content: center;
        gap: 24px;
        padding: 8px 0 4px;
        font-size: 13px;
        font-weight: 500;
        border-top: 1px solid var(--divider-color, #eee);
      }
      .cal-summary-item {
        color: var(--primary-text-color);
      }
      .cal-summary-item span {
        color: #00a651;
        font-weight: 600;
      }
      .popup-backdrop {
        position: absolute;
        inset: 0;
        z-index: 30;
      }
      .popup {
        position: absolute;
        transform: translate(-50%, -50%);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #333);
        border-radius: 12px;
        width: max-content;
        min-width: 200px;
        max-width: 80%;
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
        overflow: hidden;
        font-family: var(--primary-font-family, sans-serif);
      }
      .popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 14px;
        border-bottom: 2px solid transparent;
        border-image: linear-gradient(90deg, #00a651, #43a047, transparent) 1;
      }
      .popup-title {
        font-size: 13px;
        font-weight: 700;
      }
      .popup-close {
        cursor: pointer;
        color: var(--secondary-text-color, #999);
        --mdc-icon-size: 16px;
      }
      .popup-body {
        padding: 4px 14px 10px;
      }
      .popup-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 22px;
        padding: 5px 0;
        font-size: 12px;
        border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.06));
      }
      .popup-row:last-child {
        border-bottom: none;
      }
      .popup-row.bold {
        font-weight: 700;
        font-size: 13px;
      }
      .popup-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--primary-text-color, #333);
        white-space: nowrap;
      }
      .popup-label i {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        display: inline-block;
        flex-shrink: 0;
      }
      .popup-value {
        color: var(--primary-text-color, #333);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    `;
  }

  constructor() {
    super();
    this._dailyChart = null;
    this._monthlyChart = null;
    this._showMonthly = true;
    this._showCalendar = false;
    this._showTier = false;
    this._lastHash = null;
    this._chartLibFailed = false;
    this._popup = null;
    this._chartData = { daily: [], monthly: [] };
    this._resizeObserver = null;
    this._calYear = new Date().getFullYear();
    this._calMonth = new Date().getMonth() + 1;
  }

  static getConfigElement() {
    return document.createElement("state-grid-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:state-grid-card", entity: "", title: "国家电网" };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("请指定实体");
    }
    this.config = { title: "国家电网", show_monthly: true, ...config };
    this._showMonthly = this.config.show_monthly !== false;
    this._showCalendar = this.config.show_calendar === true;
    this._prefix = this._computePrefix(this.config.entity);
  }

  _computePrefix(entity) {
    for (const k of KNOWN_KEYS) {
      if (entity.endsWith("_" + k)) {
        return entity.slice(0, entity.length - k.length - 1);
      }
    }
    // 兜底：去掉最后一段
    return entity.replace(/_[a-z0-9_]+$/, "");
  }

  getCardSize() {
    return this._showCalendar ? 9 : 5;
  }

  _consNo() {
    // prefix 形如 sensor.state_grid_<户号>，取最后一段作为户号
    const m = /sensor\.state_grid_(.+)$/.exec(this._prefix || "");
    return m ? m[1] : "";
  }

  _entityId(key) {
    return this._prefix + "_" + key;
  }

  _num(key) {
    const s = this.hass?.states[this._entityId(key)];
    if (!s) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }

  _str(key) {
    const s = this.hass?.states[this._entityId(key)];
    return s ? s.state : "-";
  }

  _graph(key) {
    const s = this.hass?.states[this._entityId(key)];
    return s?.attributes?.graph || [];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._dailyChart) {
      this._dailyChart.destroy();
      this._dailyChart = null;
    }
    if (this._monthlyChart) {
      this._monthlyChart.destroy();
      this._monthlyChart = null;
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  firstUpdated() {
    // 图表为内置纯 SVG，按容器实际像素 1:1 绘制（文字为真实像素大小）；宽度变化时重绘
    this._resizeObserver = new ResizeObserver(() => this._drawCharts());
    const c = this.shadowRoot.querySelector("#daily-chart");
    if (c) this._resizeObserver.observe(c);
    this._drawCharts();
  }

  updated(changedProps) {
    super.updated(changedProps);
    if (changedProps.has("hass") || changedProps.has("config")) {
      const daily = this._graph("recent_30_daily_ele_list");
      const monthly = this._graph("recent_12_monthly_ele_list");
      const hash = JSON.stringify({ daily, monthly });
      if (hash !== this._lastHash) {
        this._lastHash = hash;
        this._drawCharts();
      }
    }
  }

  _isDark() {
    return (
      document
        .querySelector("home-assistant")
        ?.shadowRoot?.querySelector("home-assistant-main")
        ?.shadowRoot?.querySelector("partial-panel-resolver")
        ?.shadowRoot?.querySelector("ha-panel-lovelace")
        ?._hass?.themes?.darkMode || false
    );
  }

  _fmtDay(d) {
    // d: 'YYYYMMDD'
    const s = String(d);
    if (s.length === 8) return `${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }

  _fmtMonth(m) {
    // m: 'YYYYMM'
    const s = String(m);
    if (s.length === 6) return `${s.slice(2, 4)}-${s.slice(4, 6)}`;
    return s;
  }

  _niceMax(v) {
    if (v <= 0) return 1;
    const exp = Math.floor(Math.log10(v));
    const f = v / Math.pow(10, exp);
    let nf;
    if (f <= 1) nf = 1;
    else if (f <= 2) nf = 2;
    else if (f <= 5) nf = 5;
    else nf = 10;
    return nf * Math.pow(10, exp);
  }

  _drawCharts() {
    if (!this.shadowRoot) return;
    const daily = this._graph("recent_30_daily_ele_list");
    const monthly = this._graph("recent_12_monthly_ele_list");
    const isDark = this._isDark();
    const textColor = isDark ? "#aaa" : "#666";
    const gridColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
    const fontScale = Number(this.config?.font_size) || 1;

    this._chartData = { daily, monthly };

    const dc = this.shadowRoot.querySelector("#daily-chart");
    if (dc) {
      dc.innerHTML = this._svgStacked(daily, (d) => this._fmtDay(d.day), {
        textColor,
        gridColor,
        fontScale,
        W: dc.clientWidth || 600,
        labelEvery: Math.max(1, Math.ceil(daily.length / 8)),
      });
      this._bindChartClick(dc, "daily");
    }

    const mc = this.shadowRoot.querySelector("#monthly-chart");
    if (mc && this._showMonthly) {
      mc.innerHTML = this._svgStacked(monthly, (d) => this._fmtMonth(d.month), {
        textColor,
        gridColor,
        fontScale,
        W: mc.clientWidth || 600,
        labelEvery: 1,
      });
      this._bindChartClick(mc, "monthly");
    }
  }

  // 事件委托：点击柱子（<g data-idx>）弹出详情。用元素 onclick 赋值，不受 HA CSP 内联脚本限制
  _bindChartClick(container, kind) {
    container.onclick = (e) => {
      const g = e.target.closest("[data-idx]");
      if (!g) return;
      this._openPopup(kind, Number(g.getAttribute("data-idx")), container);
    };
  }

  _fmtDayFull(d) {
    const s = String(d);
    return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
  }

  _fmtMonthFull(m) {
    const s = String(m);
    return s.length === 6 ? `${s.slice(0, 4)}年${Number(s.slice(4, 6))}月` : s;
  }

  _openPopup(kind, idx, container) {
    const list = this._chartData?.[kind] || [];
    const d = list[idx];
    if (!d) return;
    const total = Number(d.ele) || 0;
    let title, rows;
    if (kind === "daily") {
      title = this._fmtDayFull(d.day);
      rows = [
        { label: "总用电", value: total, unit: "kWh", bold: true },
        { label: "平段用电", value: Number(d.n_ele) || 0, unit: "kWh", color: TIER_COLORS.n },
        { label: "低谷用电", value: Number(d.v_ele) || 0, unit: "kWh", color: TIER_COLORS.v },
      ];
    } else {
      title = this._fmtMonthFull(d.month);
      rows = [
        { label: "总用电", value: total, unit: "kWh", bold: true },
        { label: "电费", value: Number(d.cost) || 0, unit: "元" },
        { label: "平段用电", value: Number(d.n_ele) || 0, unit: "kWh", color: TIER_COLORS.n },
        { label: "低谷用电", value: Number(d.v_ele) || 0, unit: "kWh", color: TIER_COLORS.v },
      ];
    }
    let left = 0,
      top = 0;
    const card = this.shadowRoot.querySelector(".card");
    if (card && container) {
      const cr = card.getBoundingClientRect();
      const rr = container.getBoundingClientRect();
      left = rr.left - cr.left + rr.width / 2;
      top = rr.top - cr.top + rr.height / 2;
    }
    this._popup = { title, rows, left, top };
    this.requestUpdate();
  }

  _closePopup() {
    this._popup = null;
    this.requestUpdate();
  }

  _renderPopup() {
    const p = this._popup;
    return html`
      <div class="popup-backdrop" @click=${() => this._closePopup()}>
        <div class="popup" style="left:${p.left}px;top:${p.top}px" @click=${(e) => e.stopPropagation()}>
          <div class="popup-header">
            <span class="popup-title">${p.title}</span>
            <ha-icon class="popup-close" icon="mdi:close" @click=${() => this._closePopup()}></ha-icon>
          </div>
          <div class="popup-body">
            ${p.rows.map(
              (r) => html`
                <div class="popup-row ${r.bold ? "bold" : ""}">
                  <span class="popup-label">
                    ${r.color ? html`<i style="background:${r.color}"></i>` : ""}${r.label}
                  </span>
                  <span class="popup-value">${Number(r.value).toFixed(2)} ${r.unit}</span>
                </div>
            ` )}
          </div>
        </div>
      </div>
    `;
  }

  // 用纯 SVG 画一张堆叠柱状图（尖/峰/平/谷），返回 HTML 字符串
  _svgStacked(items, labelFn, opt) {
    const { textColor, gridColor, labelEvery = 1, fontScale = 1 } = opt;
    const yFont = (10 * fontScale).toFixed(1);
    const xFont = (9 * fontScale).toFixed(1);
    const legendFont = (11 * fontScale).toFixed(1);
    const dotSize = (9 * fontScale).toFixed(1);
    const legend =
      `<div class="chart-legend" style="font-size:${legendFont}px;gap:${(12 * fontScale).toFixed(0)}px">` +
      ["n", "v"]
        .map(
          (k) =>
            `<span><i style="background:${TIER_COLORS[k]};width:${dotSize}px;height:${dotSize}px"></i>${TIER_NAMES[k]}</span>`
        )
        .join("") +
      `</div>`;
    if (!items || !items.length)
      return (
        legend +
        `<div style="text-align:center;color:${textColor};padding:36px 0;font-size:14px">暂无数据</div>`
      );

    const W = opt.W || 640, H = 220, padL = 34, padR = 8, padT = 12, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const keys = ["v", "n"]; // 自下而上：谷→平
    const totals = items.map((d) =>
      keys.reduce((s, k) => s + (Number(d[k + "_ele"]) || 0), 0)
    );
    const niceMax = this._niceMax(Math.max(...totals, 1));
    const n = items.length, slot = plotW / n, barW = Math.min(slot * 0.6, 22);
    const y = (v) => padT + plotH * (1 - v / niceMax);

    let g = "";
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = (niceMax * i) / ticks;
      const yy = y(val);
      g += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="${gridColor}" stroke-width="1" stroke-dasharray="3 3"/>`;
      g += `<text x="${padL - 5}" y="${(yy + 3).toFixed(1)}" fill="${textColor}" font-size="${yFont}" text-anchor="end">${Math.round(val)}</text>`;
    }

    let bars = "";
    items.forEach((d, idx) => {
      const cx = padL + slot * idx + slot / 2;
      let acc = 0,
        rects = "";
      keys.forEach((k) => {
        const v = Number(d[k + "_ele"]) || 0;
        if (v <= 0) return;
        const yTop = y(acc + v),
          yBot = y(acc);
        acc += v;
        rects += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, yBot - yTop).toFixed(1)}" fill="${TIER_COLORS[k]}"/>`;
      });
      const lbl = labelFn(d);
      const showLbl = idx % labelEvery === 0;
      const tip = `${lbl} 合计 ${totals[idx].toFixed(2)} kWh（平${d.n_ele || 0} 谷${d.v_ele || 0}）`;
      bars += `<g data-idx="${idx}" style="cursor:pointer"><title>${tip}</title>${rects}${
        showLbl
          ? `<text x="${cx.toFixed(1)}" y="${H - 10}" fill="${textColor}" font-size="${xFont}" text-anchor="middle">${lbl}</text>`
          : ""
      }</g>`;
    });

    const base = `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${gridColor}" stroke-width="1"/>`;
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="xMidYMid meet" style="display:block">${g}${bars}${base}</svg>`;
    return legend + svg;
  }

  /* ===== 分时占比面板 ===== */
  _renderTierPanel() {
    const fields = [
      { k: "n", label: "平段用电", month: "month_n_ele_num", year: "year_n_ele_num" },
      { k: "v", label: "低谷用电", month: "month_v_ele_num", year: "year_v_ele_num" },
    ];
    const monthTotal = this._num("month_ele_num") || 0;
    const yearTotal = this._num("year_ele_num") || 0;

    const rows = fields.map((f) => {
      const m = this._num(f.month) || 0;
      const y = this._num(f.year) || 0;
      const pct = monthTotal > 0 ? (m / monthTotal) * 100 : 0;
      return html`
        <div class="tier-item">
          <div class="tier-header">
            <span style="color:${TIER_COLORS[f.k]}">${f.label}</span>
            <span>${m.toFixed(2)} kWh</span>
          </div>
          <div class="tier-bar">
            <div
              class="tier-bar-fill"
              style="width:${pct}%;background:${TIER_COLORS[f.k]}"
            ></div>
          </div>
          <div class="tier-info">
            <span>当月占比: ${pct.toFixed(1)}%</span>
            <span>年度累计: ${y.toFixed(2)} kWh</span>
          </div>
        </div>
      `;
    });

    return html`
      <div class="tier-section">
        <div class="chart-title">
          <ha-icon icon="mdi:chart-donut"></ha-icon> 分时用电占比（当月合计 ${monthTotal.toFixed(2)} kWh）
        </div>
        ${rows}
        <div class="tier-tip">
          💡 谷段（绿）电价最低，尽量把洗衣、充电等安排到谷时更省钱；年度累计用电 ${yearTotal.toFixed(2)} kWh。
        </div>
      </div>
    `;
  }

  /* ===== 用电日历（基于最近30天数据） ===== */
  _dailyMap() {
    const map = {};
    this._graph("recent_30_daily_ele_list").forEach((d) => {
      if (!d.day) return;
      const s = String(d.day);
      if (s.length === 8) {
        const key = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        map[key] = d;
      }
    });
    return map;
  }

  _prevMonth() {
    if (this._calMonth === 1) {
      this._calMonth = 12;
      this._calYear--;
    } else {
      this._calMonth--;
    }
    this.requestUpdate();
  }

  _nextMonth() {
    if (this._calMonth === 12) {
      this._calMonth = 1;
      this._calYear++;
    } else {
      this._calMonth++;
    }
    this.requestUpdate();
  }

  _goToToday() {
    const t = new Date();
    this._calYear = t.getFullYear();
    this._calMonth = t.getMonth() + 1;
    this.requestUpdate();
  }

  _renderCalendar() {
    const map = this._dailyMap();
    const daysInMonth = new Date(this._calYear, this._calMonth, 0).getDate();
    const firstDay = new Date(this._calYear, this._calMonth - 1, 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1; // 周一为起始

    // 计算本月最小/最大用量天
    let min = Infinity,
      max = -Infinity;
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${this._calYear}-${String(this._calMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const d = map[key];
      if (d && d.ele != null) {
        min = Math.min(min, d.ele);
        max = Math.max(max, d.ele);
      }
    }

    const today = new Date();
    const isCurrentMonth =
      this._calYear === today.getFullYear() &&
      this._calMonth === today.getMonth() + 1;

    const weekdayNames = ["一", "二", "三", "四", "五", "六", "日"];
    const weekdaysRow = weekdayNames.map(
      (d) => html`<div class="cal-weekday">${d}</div>`
    );

    const dayCells = [];
    for (let i = 0; i < adjustedFirst; i++)
      dayCells.push(html`<div class="cal-day empty"></div>`);

    let total = 0,
      count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${this._calYear}-${String(this._calMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const d = map[key];
      const isToday =
        isCurrentMonth &&
        i === today.getDate();
      let cls = "cal-day";
      if (isToday) cls += " today";
      if (d && d.ele != null) {
        total += d.ele;
        count++;
        if (d.ele === min && min !== max) cls += " min-usage";
        else if (d.ele === max && min !== max) cls += " max-usage";
      }
      dayCells.push(html`
        <div class="${cls}">
          <div class="cal-day-num">${i}</div>
          ${d && d.ele != null
            ? html`<div class="cal-day-usage">${Number(d.ele).toFixed(1)}</div>`
            : ""}
        </div>
      `);
    }
    const totalCells = adjustedFirst + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder > 0)
      for (let i = 0; i < 7 - remainder; i++)
        dayCells.push(html`<div class="cal-day empty"></div>`);

    const avg = count > 0 ? (total / count).toFixed(2) : "0.00";

    return html`
      <div class="calendar-grid">
        <div class="cal-nav-row">
          <div class="cal-nav-btn" @click=${() => this._prevMonth()}>◀</div>
          <div class="cal-year-month">${this._calYear}年${this._calMonth}月</div>
          <div class="cal-nav-btn ${isCurrentMonth ? "disabled" : ""}" @click=${() => this._nextMonth()}>▶</div>
          <div class="cal-today-btn" @click=${() => this._goToToday()}>
            ${isCurrentMonth ? "本月" : "返回本月"}
          </div>
        </div>
        ${weekdaysRow} ${dayCells}
        <div class="cal-summary-row">
          <div class="cal-summary-item">用电 <span>${total.toFixed(2)}</span> kWh</div>
          <div class="cal-summary-item">日均 <span>${avg}</span> kWh</div>
          <div class="cal-summary-item">记录 <span>${count}</span> 天</div>
        </div>
      </div>
    `;
  }

  _toggle(key) {
    this["_" + key] = !this["_" + key];
    if (key === "showMonthly") {
      // 等 DOM 更新出 #monthly-chart 容器后再绘图
      this.requestUpdate();
      this.updateComplete.then(() => this._drawCharts());
    } else {
      this.requestUpdate();
    }
  }

  render() {
    if (!this.hass || !this.config) return html``;
    const dailyState = this.hass.states[this.config.entity];
    if (!dailyState) {
      return html`<ha-card
        ><div class="no-data">未找到实体数据，请先配置集成</div></ha-card
      >`;
    }

    const balance = this._num("balance");
    const monthCost = this._num("esti_amt");
    const monthEle = this._num("month_ele_num");
    const dailyEle = this._num("daily_ele_num");

    const fmt = (v, unit, digits = 2) =>
      v === null || v === undefined ? "-" : v.toFixed(digits) + (unit ? " " + unit : "");

    return html`
      <ha-card>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <img class="card-logo" src="/state_grid-local/logo.png" alt="logo" />
                ${this.config.title || "国家电网"}
              </div>
            </div>
          </div>

          <div class="summary-row">
            <div class="summary-item">
              <div class="summary-icon"><ha-icon icon="mdi:wallet"></ha-icon></div>
              <div class="summary-value ${balance !== null && balance < 0 ? "red" : "green"}">
                ${balance === null ? "-" : balance.toFixed(2)}
              </div>
              <div class="summary-label">账户余额<br>(元)</div>
            </div>
            <div class="summary-item">
              <div class="summary-icon"><ha-icon icon="mdi:currency-cny"></ha-icon></div>
              <div class="summary-value orange">${monthCost === null ? "-" : monthCost.toFixed(2)}</div>
              <div class="summary-label">本月电费<br>(元)</div>
            </div>
            <div class="summary-item">
              <div class="summary-icon"><ha-icon icon="mdi:power-plug"></ha-icon></div>
              <div class="summary-value blue">${monthEle === null ? "-" : monthEle.toFixed(2)}</div>
              <div class="summary-label">当月用电<br>(kWh)</div>
            </div>
            <div class="summary-item">
              <div class="summary-icon"><ha-icon icon="mdi:flash"></ha-icon></div>
              <div class="summary-value green">${dailyEle === null ? "-" : dailyEle.toFixed(2)}</div>
              <div class="summary-label">昨日用电<br>(kWh)</div>
            </div>
          </div>

          <div class="chart-section">
            <div class="chart-title">
              <ha-icon icon="mdi:chart-bar"></ha-icon> 近 30 天分时用电
            </div>
            <div id="daily-chart" class="chart-container"></div>
          </div>

          ${this._showMonthly
            ? html`
                <div class="chart-section">
                  <div class="chart-title">
                    <ha-icon icon="mdi:chart-line"></ha-icon> 近 12 个月用电
                  </div>
                  <div id="monthly-chart" class="chart-container"></div>
                </div>
              `
            : ""}

          <div class="toggle-row">
            <div
              class="toggle-btn ${this._showMonthly ? "active" : ""}"
              @click=${() => this._toggle("showMonthly")}
            >
              <ha-icon icon="mdi:chart-line"></ha-icon> 月度趋势
            </div>
            <div
              class="toggle-btn ${this._showTier ? "active" : ""}"
              @click=${() => this._toggle("showTier")}
            >
              <ha-icon icon="mdi:chart-donut"></ha-icon> 分时占比
            </div>
            <div
              class="toggle-btn ${this._showCalendar ? "active" : ""}"
              @click=${() => this._toggle("showCalendar")}
            >
              <ha-icon icon="mdi:calendar-month"></ha-icon> 用电日历
            </div>
          </div>

          ${this._showTier ? this._renderTierPanel() : ""} ${this._showCalendar ? this._renderCalendar() : ""}

          <div class="info-row">
            <span class="info-label"><ha-icon icon="mdi:calendar-check"></ha-icon> 上月用电</span>
            <span class="info-value">${fmt(this._num("last_month_ele_num"), "kWh")}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><ha-icon icon="mdi:cash"></ha-icon> 上月电费</span>
            <span class="info-value">${fmt(this._num("last_month_ele_cost"), "元")}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><ha-icon icon="mdi:calendar-range"></ha-icon> 年度累计用电</span>
            <span class="info-value">${fmt(this._num("year_ele_num"), "kWh")}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><ha-icon icon="mdi:file-document-outline"></ha-icon> 年度累计电费</span>
            <span class="info-value">${fmt(this._num("year_ele_cost"), "元")}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><ha-icon icon="mdi:history"></ha-icon> 最近刷新</span>
            <span class="info-value">${this._str("refresh_time")}</span>
          </div>
        ${this._popup ? this._renderPopup() : ""}
        </div>
      </ha-card>
    `;
  }
}
customElements.define("state-grid-card", StateGridCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "state-grid-card",
  name: "国家电网卡片",
  description: "展示国家电网用电数据：近30天分时用电、月度趋势、分时占比与用电日历",
  documentationURL: "https://github.com/tiejiang29/state_grid",
});

// 通知 HA 前端重新渲染，解决刷新后 "Custom element doesn't exist" 问题
window.dispatchEvent(new CustomEvent("custom-cards-updated", { bubbles: true }));
setTimeout(() => {
  window.dispatchEvent(new CustomEvent("custom-cards-updated", { bubbles: true }));
}, 1000);
