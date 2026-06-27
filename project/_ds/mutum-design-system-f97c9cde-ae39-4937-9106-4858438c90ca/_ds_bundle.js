/* @ds-bundle: {"format":3,"namespace":"MutumDesignSystem_f97c9c","components":[],"sourceHashes":{"ui_kits/mobile/app.jsx":"fd440999f079","ui_kits/mobile/ios-frame.jsx":"d67eb3ffe562","ui_kits/web/app.jsx":"e72179224149"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MutumDesignSystem_f97c9c = window.MutumDesignSystem_f97c9c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/mobile/app.jsx
try { (() => {
/* global React, IOSDevice */
const {
  useState
} = React;
const BIRD = "../../assets/mark-bird.svg";

/* ============== SHARED ============== */
function TabBar({
  active,
  onChange
}) {
  const tabs = [{
    id: 'home',
    label: 'Início',
    icon: '⌂'
  }, {
    id: 'collect',
    label: 'Coletar',
    icon: '◉'
  }, {
    id: 'history',
    label: 'Histórico',
    icon: '◷'
  }, {
    id: 'profile',
    label: 'Perfil',
    icon: '◯'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(240,239,235,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      padding: '8px 12px 24px',
      display: 'flex',
      zIndex: 5
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => onChange(t.id),
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      color: active === t.id ? 'var(--mutum-red)' : 'var(--fg-3)',
      padding: '6px 0',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      lineHeight: 1
    }
  }, t.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600
    }
  }, t.label))));
}

/* ============== LOGIN ============== */
function LoginScreen({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      display: 'flex',
      flexDirection: 'column',
      padding: '72px 28px 32px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: BIRD,
    style: {
      height: 80,
      alignSelf: 'flex-start',
      marginBottom: 40
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 36,
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      marginBottom: 14
    }
  }, "Mutum \xC1gua."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--fg-2)',
      lineHeight: 1.45,
      marginBottom: 36
    }
  }, "Acompanha a qualidade da \xE1gua da sua comunidade \u2014 direto do celular."), /*#__PURE__*/React.createElement("button", {
    onClick: onLogin,
    style: {
      padding: '16px',
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(237,44,39,.22)',
      marginBottom: 12
    }
  }, "Entrar como agente"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '16px',
      background: 'transparent',
      color: 'var(--fg-1)',
      border: '1.5px solid var(--border-strong)',
      borderRadius: 14,
      fontWeight: 600,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Entrar com SUS Digital"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      fontSize: 13,
      color: 'var(--fg-3)',
      textAlign: 'center',
      lineHeight: 1.5
    }
  }, "Funciona sem internet em campo.", /*#__PURE__*/React.createElement("br", null), "Sincroniza quando chegar perto de um sinal."));
}

/* ============== HOME ============== */
function HomeScreen({
  onCollect,
  onOpenPoint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      overflow: 'auto',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '56px 24px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fg-3)',
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: 4
    }
  }, "Quarta \xB7 28 maio"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: '-0.02em'
    }
  }, "Oi, Dona Rita.")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'var(--mutum-coral)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--mutum-ink)',
      fontWeight: 700
    }
  }, "R")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--mutum-ink)',
      color: 'var(--mutum-bone)',
      borderRadius: 24,
      padding: 24,
      marginBottom: 20,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: BIRD,
    style: {
      position: 'absolute',
      right: -30,
      top: -20,
      height: 160,
      opacity: 0.14,
      pointerEvents: 'none'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--mutum-coral)',
      marginBottom: 14
    }
  }, "Comunidade do Tarum\xE3"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      background: '#E8A33D',
      borderRadius: '50%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1
    }
  }, "Aten\xE7\xE3o")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: '#B5AFA4',
      lineHeight: 1.5,
      marginBottom: 18
    }
  }, "Turbidez acima do limite no ponto Igarap\xE9 Norte. \xDAltima coleta h\xE1 3 horas."), /*#__PURE__*/React.createElement("button", {
    onClick: onCollect,
    style: {
      padding: '10px 16px',
      background: 'var(--mutum-coral)',
      color: 'var(--mutum-ink)',
      border: 'none',
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer'
    }
  }, "+ Nova coleta"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginBottom: 24
    }
  }, [['12', 'Coletas', 'esta semana'], ['9', 'OK', 'dentro do limite'], ['3', 'Alertas', 'fora do limite']].map(([n, l, s]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 14,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      marginBottom: 2
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fg-1)',
      fontWeight: 600
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)'
    }
  }, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 18
    }
  }, "Pontos monitorados"), /*#__PURE__*/React.createElement("a", {
    style: {
      fontSize: 13,
      color: 'var(--mutum-red)',
      fontWeight: 600
    }
  }, "Mapa \u2192")), [{
    name: 'Igarapé Norte',
    state: 'Atenção',
    color: 'var(--mutum-amber)',
    last: 'Turbidez 18 NTU · há 3h',
    dist: '420m'
  }, {
    name: 'Poço da escola',
    state: 'OK',
    color: 'var(--mutum-leaf)',
    last: 'pH 7,2 · há 6h',
    dist: '1,2 km'
  }, {
    name: 'Cacimba comunitária',
    state: 'OK',
    color: 'var(--mutum-leaf)',
    last: 'pH 7,0 · ontem',
    dist: '2,1 km'
  }, {
    name: 'Igarapé Sul',
    state: 'Coleta atrasada',
    color: 'var(--mutum-red-deep)',
    last: 'última há 4 dias',
    dist: '3,4 km'
  }].map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    onClick: () => onOpenPoint(p),
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      background: 'color-mix(in srgb, ' + p.color + ' 14%, transparent)',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: p.color,
      fontSize: 18
    }
  }, "\u25C9"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14,
      marginBottom: 2
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fg-3)'
    }
  }, p.last)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '3px 10px',
      background: 'color-mix(in srgb, ' + p.color + ' 14%, transparent)',
      color: p.color,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      display: 'inline-block',
      marginBottom: 4
    }
  }, p.state), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, p.dist))))));
}

/* ============== POINT DETAIL ============== */
function PointScreen({
  point,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      overflow: 'auto',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '52px 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      position: 'sticky',
      top: 0,
      background: 'rgba(240,239,235,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: 22,
      color: 'var(--mutum-red)',
      cursor: 'pointer',
      padding: 4
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, "Voltar"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      fontSize: 22,
      color: 'var(--fg-2)',
      padding: 4
    }
  }, "\u22EF")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 24px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: '-0.02em'
    }
  }, point.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u22123.0728, \u221260.0260 \xB7 ", point.dist)), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '4px 12px',
      background: 'color-mix(in srgb, ' + point.color + ' 14%, transparent)',
      color: point.color,
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    }
  }, point.state))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 10
    }
  }, "\xDAltima leitura"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 16,
      border: '1px solid var(--border)',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10
    }
  }, [['pH', '6,8', 'OK', 'var(--mutum-leaf)'], ['Turbidez', '18 NTU', 'Alto', 'var(--mutum-red-deep)'], ['Temp', '28,4°C', 'OK', 'var(--mutum-leaf)'], ['Condutividade', '142 µS', 'OK', 'var(--mutum-leaf)']].map(([k, v, s, c]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      padding: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)',
      marginBottom: 4
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      marginBottom: 2
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: c,
      fontWeight: 700
    }
  }, s))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 10
    }
  }, "Turbidez \xB7 \xFAltimos 7 dias"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 16,
      border: '1px solid var(--border)',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 320 100",
    style: {
      width: '100%',
      height: 100
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "g",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#ED2C27",
    stopOpacity: "0.2"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#ED2C27",
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "40",
    x2: "320",
    y2: "40",
    stroke: "#E8A33D",
    strokeWidth: "1",
    strokeDasharray: "3,3",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: "6",
    y: "36",
    fontSize: "9",
    fill: "#E8A33D",
    fontFamily: "var(--font-mono)"
  }, "limite 10"), /*#__PURE__*/React.createElement("path", {
    d: "M0,70 L45,68 L90,65 L135,60 L180,52 L225,45 L270,30 L320,22 L320,100 L0,100 Z",
    fill: "url(#g)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0,70 L45,68 L90,65 L135,60 L180,52 L225,45 L270,30 L320,22",
    stroke: "#ED2C27",
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 10
    }
  }, "Coletas recentes"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, [['Hoje 11:22', 'Rita Mendes', '18 NTU'], ['Hoje 08:14', 'Rita Mendes', '14 NTU'], ['Ontem 16:48', 'João Soares', '12 NTU'], ['Ontem 09:02', 'Rita Mendes', '10 NTU']].map(([when, who, v], i) => /*#__PURE__*/React.createElement("div", {
    key: when,
    style: {
      padding: 14,
      borderTop: i ? '1px solid var(--border)' : 'none',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, when), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)'
    }
  }, who)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 600
    }
  }, v))))));
}

/* ============== COLLECT FLOW ============== */
function CollectScreen({
  onDone,
  onBack
}) {
  const [step, setStep] = useState(0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      overflow: 'auto',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '52px 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      position: 'sticky',
      top: 0,
      background: 'rgba(240,239,235,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: 'transparent',
      border: 'none',
      fontSize: 22,
      color: 'var(--mutum-red)',
      cursor: 'pointer',
      padding: 4
    }
  }, "\xD7"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, "Nova coleta \xB7 etapa ", step + 1, "/3")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      background: i <= step ? 'var(--mutum-red)' : 'var(--border)'
    }
  })))), step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: '-0.02em',
      marginBottom: 8
    }
  }, "Onde voc\xEA t\xE1?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 24
    }
  }, "A gente j\xE1 pegou seu GPS. Confirma o ponto."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 16,
      border: '1.5px solid var(--mutum-red)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--mutum-red)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--mutum-red)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, "GPS sugere")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 18,
      marginBottom: 4
    }
  }, "Igarap\xE9 Norte"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fg-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u22123.0728, \u221260.0260 \xB7 420m")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--fg-3)',
      marginBottom: 8
    }
  }, "Ou escolha outro ponto:"), ['Poço da escola', 'Cacimba comunitária', 'Outro ponto…'].map(o => /*#__PURE__*/React.createElement("div", {
    key: o,
    style: {
      padding: 14,
      background: 'var(--surface)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      marginBottom: 6,
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, o)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(1),
    style: {
      width: '100%',
      padding: 16,
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(237,44,39,.2)',
      marginTop: 20
    }
  }, "Continuar \u2192")), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: '-0.02em',
      marginBottom: 8
    }
  }, "Conecta o sensor."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 24
    }
  }, "Aproxima o kit do celular. A gente conecta sozinho."), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 20px',
      background: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      marginBottom: 16,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: 'var(--mutum-blush)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 16px',
      fontSize: 32,
      color: 'var(--mutum-red)'
    }
  }, "\u25C9"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 18,
      marginBottom: 4
    }
  }, "Procurando sensor\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-3)'
    }
  }, "Bluetooth ativado")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: 'var(--bg-3)',
      borderRadius: 12,
      fontSize: 12,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fg-1)'
    }
  }, "N\xE3o tem o kit?"), " Voc\xEA ainda pode registrar valores manualmente."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(2),
    style: {
      width: '100%',
      padding: 16,
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(237,44,39,.2)',
      marginBottom: 8
    }
  }, "Sensor conectado \u2713"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      padding: 14,
      background: 'transparent',
      color: 'var(--fg-1)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Registrar manualmente")), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 26,
      letterSpacing: '-0.02em',
      marginBottom: 8
    }
  }, "Leitura pronta."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 24
    }
  }, "Confirma os valores. Se tiver foto, d\xE1 pra anexar."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 16,
      padding: 16,
      border: '1px solid var(--border)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10
    }
  }, [['pH', '6,2'], ['Turbidez', '22 NTU'], ['Temp', '28,9°C'], ['Cond.', '138 µS']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      padding: 12,
      background: 'var(--bg-3)',
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)',
      marginBottom: 4
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 22,
      fontWeight: 700
    }
  }, v))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: 'rgba(232,163,61,0.12)',
      borderRadius: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#8A5A0F',
      marginBottom: 4
    }
  }, "Acima do limite"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#8A5A0F',
      lineHeight: 1.4
    }
  }, "Turbidez (22 NTU) passou do recomendado (10 NTU). Vou avisar a equipe da regi\xE3o.")), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      padding: 14,
      background: 'var(--surface)',
      borderRadius: 12,
      border: '1px dashed var(--border-strong)',
      textAlign: 'center',
      fontSize: 13,
      color: 'var(--fg-2)',
      marginBottom: 20,
      cursor: 'pointer'
    }
  }, "+ Anexar foto do local"), /*#__PURE__*/React.createElement("button", {
    onClick: onDone,
    style: {
      width: '100%',
      padding: 16,
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(237,44,39,.2)'
    }
  }, "Salvar coleta")));
}

/* ============== SUCCESS ============== */
function SuccessScreen({
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      display: 'flex',
      flexDirection: 'column',
      padding: '72px 28px 32px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: BIRD,
    style: {
      height: 100,
      alignSelf: 'center',
      marginTop: 60,
      marginBottom: 24
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 32,
      letterSpacing: '-0.03em',
      lineHeight: 1.05,
      marginBottom: 12,
      textAlign: 'center'
    }
  }, "Pronto. Salvo."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      textAlign: 'center',
      marginBottom: 32
    }
  }, "Sincronizamos com a base quando voc\xEA chegar perto de um sinal. 3 agentes foram avisados."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      padding: 16,
      border: '1px solid var(--border)',
      marginBottom: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 10
    }
  }, "Resumo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Igarap\xE9 Norte"), " \xB7 28 maio 11:22"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-2)'
    }
  }, "Turbidez 22 NTU \xB7 pH 6,2 \xB7 sinalizado como alerta")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      padding: '16px',
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Voltar pro in\xEDcio"));
}

/* ============== HISTORY ============== */
function HistoryScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      overflow: 'auto',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '56px 24px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: '-0.02em',
      marginBottom: 4
    }
  }, "Hist\xF3rico"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--fg-2)',
      marginBottom: 20
    }
  }, "Suas coletas, ordenadas por dia."), [{
    day: 'Hoje · 28 maio',
    items: [['11:22', 'Igarapé Norte', '22 NTU', 'Alerta', 'var(--mutum-amber)'], ['08:14', 'Igarapé Norte', '14 NTU', 'OK', 'var(--mutum-leaf)']]
  }, {
    day: 'Ontem · 27 maio',
    items: [['16:48', 'Poço da escola', 'pH 7,2', 'OK', 'var(--mutum-leaf)'], ['09:02', 'Cacimba comunitária', 'pH 7,0', 'OK', 'var(--mutum-leaf)']]
  }, {
    day: '26 maio',
    items: [['14:30', 'Igarapé Sul', '8 NTU', 'OK', 'var(--mutum-leaf)']]
  }].map(g => /*#__PURE__*/React.createElement("div", {
    key: g.day,
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 10,
      padding: '0 4px'
    }
  }, g.day), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, g.items.map(([when, name, v, s, c], i) => /*#__PURE__*/React.createElement("div", {
    key: when + name,
    style: {
      padding: 14,
      borderTop: i ? '1px solid var(--border)' : 'none',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fg-3)',
      fontFamily: 'var(--font-mono)'
    }
  }, when, " \xB7 ", v)), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '3px 10px',
      background: 'color-mix(in srgb, ' + c + ' 14%, transparent)',
      color: c,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700
    }
  }, s))))))));
}

/* ============== PROFILE ============== */
function ProfileScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--mutum-cream)',
      overflow: 'auto',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '56px 24px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 28,
      letterSpacing: '-0.02em',
      marginBottom: 20
    }
  }, "Perfil"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 16,
      padding: 20,
      border: '1px solid var(--border)',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--mutum-coral)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--mutum-ink)',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 22
    }
  }, "R"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 18
    }
  }, "Rita Mendes"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-3)'
    }
  }, "Agente comunit\xE1ria \xB7 Tarum\xE3"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      padding: '2px 8px',
      background: 'var(--mutum-blush)',
      color: 'var(--mutum-red-deep)',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      display: 'inline-block'
    }
  }, "47 coletas"))), [['Conta', ['Dados pessoais', 'Idiomas', 'Notificações']], ['Equipamento', ['Kits cadastrados', 'Calibrar sensor', 'Status da bateria']], ['Comunidade', ['Tarumã (atual)', 'Trocar de comunidade', 'Convidar agente']], ['Sobre', ['Como usar', 'Manual do agente', 'Termo de uso']]].map(([h, items]) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--fg-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 8,
      padding: '0 4px'
    }
  }, h), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it,
    style: {
      padding: '14px 16px',
      borderTop: i ? '1px solid var(--border)' : 'none',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      flex: 1
    }
  }, it), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg-3)'
    }
  }, "\u203A")))))), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      padding: 14,
      background: 'transparent',
      color: 'var(--mutum-red-deep)',
      border: '1px solid var(--border-strong)',
      borderRadius: 12,
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer',
      marginTop: 8
    }
  }, "Sair")));
}

/* ============== ROUTER ============== */
function App() {
  const [screen, setScreen] = useState('login');
  const [tab, setTab] = useState('home');
  const [point, setPoint] = useState(null);
  function handleTab(t) {
    setTab(t);
    if (t === 'home') setScreen('home');
    if (t === 'collect') setScreen('collect');
    if (t === 'history') setScreen('history');
    if (t === 'profile') setScreen('profile');
  }
  const fullScreen = screen === 'login' || screen === 'collect' || screen === 'success' || screen === 'point';
  const showTabs = !fullScreen;
  return /*#__PURE__*/React.createElement(IOSDevice, {
    width: 402,
    height: 874
  }, screen === 'login' && /*#__PURE__*/React.createElement(LoginScreen, {
    onLogin: () => setScreen('home')
  }), screen === 'home' && /*#__PURE__*/React.createElement(HomeScreen, {
    onCollect: () => setScreen('collect'),
    onOpenPoint: p => {
      setPoint(p);
      setScreen('point');
    }
  }), screen === 'point' && /*#__PURE__*/React.createElement(PointScreen, {
    point: point,
    onBack: () => setScreen('home')
  }), screen === 'collect' && /*#__PURE__*/React.createElement(CollectScreen, {
    onDone: () => setScreen('success'),
    onBack: () => setScreen('home')
  }), screen === 'success' && /*#__PURE__*/React.createElement(SuccessScreen, {
    onClose: () => setScreen('home')
  }), screen === 'history' && /*#__PURE__*/React.createElement(HistoryScreen, null), screen === 'profile' && /*#__PURE__*/React.createElement(ProfileScreen, null), showTabs && /*#__PURE__*/React.createElement(TabBar, {
    active: tab,
    onChange: handleTab
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ios-frame.jsx
try { (() => {
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports: IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ios-frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web/app.jsx
try { (() => {
/* global React */
const {
  useState
} = React;

/* ============== NAV ============== */
function Nav() {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(240, 239, 235, 0.78)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '16px 48px',
      display: 'flex',
      alignItems: 'center',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      textDecoration: 'none',
      color: 'var(--fg-1)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/mark-bird.svg",
    style: {
      height: 32
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 24,
      letterSpacing: '-0.02em'
    }
  }, "MUTUM")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      marginLeft: 16
    }
  }, ['O que fazemos', 'Produtos', 'Manifesto', 'Carreiras'].map((t, i) => /*#__PURE__*/React.createElement("a", {
    key: t,
    href: "#",
    style: {
      fontSize: 14,
      fontWeight: i === 0 ? 600 : 500,
      color: i === 0 ? 'var(--fg-1)' : 'var(--fg-2)',
      textDecoration: 'none'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-primary"
  }, "Falar com a gente"))));
}

/* ============== HERO ============== */
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '120px 48px 80px',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 920
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 28
    }
  }, "Startup amazonense de tecnologia"), /*#__PURE__*/React.createElement("h1", {
    className: "h-display",
    style: {
      marginBottom: 32,
      fontSize: 'clamp(56px, 9vw, 104px)'
    }
  }, "Tecnologia", /*#__PURE__*/React.createElement("br", null), "pro Norte", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--mutum-red)'
    }
  }, "e o Nordeste.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 24,
      lineHeight: 1.4,
      color: 'var(--fg-2)',
      maxWidth: 720,
      marginBottom: 44,
      fontWeight: 400
    }
  }, "A gente constr\xF3i produtos digitais que resolvem problemas reais da nossa regi\xE3o. Da floresta pro sert\xE3o, do ribeirinho ao centro urbano."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-primary btn-lg"
  }, "Ver o que constru\xEDmos"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost btn-lg"
  }, "Trabalhar com a gente \u2192"))), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/mark-bird.svg",
    style: {
      position: 'absolute',
      right: -60,
      top: 60,
      height: 480,
      opacity: 0.08,
      pointerEvents: 'none'
    },
    alt: ""
  }));
}

/* ============== MANIFESTO ============== */
function Manifesto() {
  const pillars = [{
    title: 'Daqui pra cá.',
    body: 'A maior parte da tecnologia que a gente usa foi pensada em São Paulo, Califórnia ou Berlim. A Mutum desenha pro contexto que conhece — onde nasceu.'
  }, {
    title: 'Problema real, não buzzword.',
    body: 'A gente começa pelo problema. Água que não dá pra beber. Acesso a crédito. Educação. Saúde pública. Depois pensa na tecnologia.'
  }, {
    title: 'Construído pra durar.',
    body: 'Cada produto tem que funcionar com pouca infraestrutura, baixa banda e em campo. Nada de demo bonito que quebra na realidade.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--bg-2)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '120px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 20
    }
  }, "Como a gente pensa"), /*#__PURE__*/React.createElement("h2", {
    className: "h1",
    style: {
      marginBottom: 80,
      maxWidth: 800
    }
  }, "Tr\xEAs coisas que a gente acredita."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 40
    }
  }, pillars.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.title
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 64,
      color: 'var(--mutum-red)',
      letterSpacing: '-0.04em',
      marginBottom: 24,
      lineHeight: 1
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("h3", {
    className: "h3",
    style: {
      marginBottom: 12
    }
  }, p.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: 'var(--fg-2)',
      lineHeight: 1.6
    }
  }, p.body))))));
}

/* ============== FEATURED PRODUCT — MUTUM ÁGUA ============== */
function FeaturedProduct() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '120px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 20
    }
  }, "Em desenvolvimento"), /*#__PURE__*/React.createElement("h2", {
    className: "h1",
    style: {
      marginBottom: 24,
      maxWidth: 760
    }
  }, "Primeiro produto: Mutum \xC1gua."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 20,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 64,
      maxWidth: 680
    }
  }, "Monitoramento de qualidade da \xE1gua pra comunidades ribeirinhas, sa\xFAde p\xFAblica e ind\xFAstria. Coleta no campo, an\xE1lise no celular, dashboard na cidade."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--mutum-ink)',
      color: 'var(--mutum-bone)',
      borderRadius: 32,
      padding: 0,
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 0,
      minHeight: 480
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 56,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--mutum-coral)',
      marginBottom: 18
    }
  }, "Mutum \xC1gua \xB7 v0.4 beta"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 40,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
      marginBottom: 20
    }
  }, "Coleta, an\xE1lise e alerta \u2014 tudo em um ciclo."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: '#B5AFA4',
      lineHeight: 1.6,
      marginBottom: 32
    }
  }, "Sensores de baixo custo medem pH, turbidez, condutividade e temperatura. Os dados sobem por 4G ou LoRa pro nosso backend e disparam alertas pra agentes de sa\xFAde da regi\xE3o."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16
    }
  }, [['12', 'comunidades em piloto'], ['1.847', 'amostras analisadas'], ['72h', 'tempo médio até alerta'], ['R$ 89', 'custo por kit de sensor']].map(([n, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--mutum-cream)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#877F73'
    }
  }, l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '12px 20px',
      background: 'var(--mutum-coral)',
      color: 'var(--mutum-ink)',
      border: 'none',
      borderRadius: 12,
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Ver estudo de caso"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '12px 20px',
      background: 'transparent',
      color: 'var(--mutum-bone)',
      border: '1px solid #4A4742',
      borderRadius: 12,
      fontWeight: 600,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Parcerias \u2192"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#1F1E1C',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#2A2826',
      borderRadius: 16,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#877F73',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: 4
    }
  }, "Igarap\xE9 do Tarum\xE3 \xB7 Coleta 23"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 18
    }
  }, "An\xE1lise \xB7 14:22")), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '3px 10px',
      background: 'rgba(232,163,61,0.15)',
      color: '#E8A33D',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700
    }
  }, "Aten\xE7\xE3o")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10,
      marginBottom: 14
    }
  }, [['pH', '6,2', 'baixo', 'var(--mutum-amber)'], ['Turbidez', '18 NTU', 'alto', 'var(--mutum-red-deep)'], ['Temp', '28,4°C', 'ok', '#3F8A5B'], ['Cond.', '142 µS', 'ok', '#3F8A5B']].map(([k, v, s, c]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      background: '#34322E',
      padding: 12,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#877F73',
      marginBottom: 4
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 20,
      fontWeight: 700,
      marginBottom: 2
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: c,
      fontWeight: 600
    }
  }, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: 'rgba(237,44,39,0.1)',
      borderRadius: 10,
      border: '1px solid rgba(237,44,39,0.25)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#EE736E',
      marginBottom: 4
    }
  }, "Alerta autom\xE1tico enviado"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#B5AFA4',
      lineHeight: 1.4
    }
  }, "3 agentes da regi\xE3o receberam notifica\xE7\xE3o por WhatsApp."))))));
}

/* ============== PORTFOLIO TEASER ============== */
function Portfolio() {
  const items = [{
    tag: 'Em piloto',
    name: 'Mutum Água',
    desc: 'Monitoramento de qualidade da água em comunidades ribeirinhas.',
    color: 'var(--mutum-river)'
  }, {
    tag: 'Pesquisa',
    name: 'Mutum Crédito',
    desc: 'Score de crédito alternativo pra economia informal do Norte.',
    color: 'var(--mutum-leaf)'
  }, {
    tag: 'Conceito',
    name: 'Mutum Saúde',
    desc: 'Triagem assistida por IA pra postos de saúde remotos.',
    color: 'var(--mutum-coral)'
  }, {
    tag: 'Conceito',
    name: 'Mutum Escola',
    desc: 'Material educacional offline pra escolas com baixa conectividade.',
    color: 'var(--mutum-amber)'
  }];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--bg-2)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '120px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 20
    }
  }, "Portf\xF3lio"), /*#__PURE__*/React.createElement("h2", {
    className: "h1",
    style: {
      marginBottom: 24,
      maxWidth: 760
    }
  }, "O que t\xE1 no forno."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 20,
      color: 'var(--fg-2)',
      lineHeight: 1.5,
      marginBottom: 56,
      maxWidth: 680
    }
  }, "A gente trabalha em v\xE1rias frentes. Algumas em piloto, outras em pesquisa, outras ainda em ideia."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 20
    }
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.name,
    style: {
      padding: 32,
      background: 'var(--surface)',
      borderRadius: 20,
      border: '1px solid var(--border)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: it.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--fg-2)'
    }
  }, it.tag)), /*#__PURE__*/React.createElement("h3", {
    className: "h3",
    style: {
      marginBottom: 8
    }
  }, it.name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: 'var(--fg-2)',
      lineHeight: 1.5
    }
  }, it.desc))))));
}

/* ============== TEAM/PLACES ============== */
function Where() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '120px 48px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.2fr',
      gap: 80,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 20
    }
  }, "Onde a gente t\xE1"), /*#__PURE__*/React.createElement("h2", {
    className: "h1",
    style: {
      marginBottom: 24
    }
  }, "Daqui pra todo lado."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      color: 'var(--fg-2)',
      lineHeight: 1.6,
      marginBottom: 24
    }
  }, "Sede em Manaus. Equipe distribu\xEDda entre AM, PA, MA, CE e PE. A gente acredita que tecnologia de ponta pode nascer no Norte e no Nordeste \u2014 e que isso muda o jogo."), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost btn-lg"
  }, "Conhecer o time \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12
    }
  }, [['Manaus, AM', 'Sede · 14 pessoas'], ['Belém, PA', '3 pessoas'], ['São Luís, MA', '2 pessoas'], ['Fortaleza, CE', '4 pessoas'], ['Recife, PE', '3 pessoas'], ['Remoto', '6 pessoas']].map(([c, p]) => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      padding: 24,
      background: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 20,
      letterSpacing: '-0.015em',
      marginBottom: 4
    }
  }, c), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fg-3)'
    }
  }, p))))));
}

/* ============== CTA + FOOTER ============== */
function CTA() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: 1280,
      margin: '0 auto',
      padding: '40px 48px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--mutum-red)',
      color: 'var(--mutum-cream)',
      borderRadius: 32,
      padding: '88px 64px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/mark-bird.svg",
    style: {
      position: 'absolute',
      right: -60,
      top: -40,
      height: 420,
      opacity: 0.18,
      pointerEvents: 'none',
      filter: 'brightness(0) invert(1)'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 1.05,
      letterSpacing: '-0.03em',
      marginBottom: 20
    }
  }, "Tem um problema pra resolver?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 20,
      lineHeight: 1.45,
      marginBottom: 36,
      opacity: 0.92
    }
  }, "Se voc\xEA \xE9 prefeitura, ONG, pesquisador ou empresa do Norte/Nordeste e tem um problema de tecnologia \u2014 fala com a gente. A gente escuta primeiro, prop\xF5e depois."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '16px 28px',
      background: 'var(--mutum-cream)',
      color: 'var(--mutum-ink)',
      border: 'none',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "contato@mutum.tec.br"), /*#__PURE__*/React.createElement("button", {
    style: {
      padding: '16px 28px',
      background: 'transparent',
      color: 'var(--mutum-cream)',
      border: '1px solid rgba(240,239,235,0.4)',
      borderRadius: 14,
      fontWeight: 600,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Mandar um WhatsApp")))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--mutum-ink)',
      color: 'var(--mutum-bone)',
      padding: '64px 48px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr',
      gap: 48,
      marginBottom: 56
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/mark-bird.svg",
    style: {
      height: 28
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: '-0.02em'
    }
  }, "MUTUM")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: '#9A9388',
      maxWidth: 320,
      lineHeight: 1.55
    }
  }, "Startup amazonense de tecnologia. Construindo pro Norte e Nordeste do Brasil.")), [['Empresa', ['Manifesto', 'Time', 'Carreiras', 'Imprensa']], ['Produtos', ['Mutum Água', 'Mutum Crédito', 'Mutum Saúde', 'Mutum Escola']], ['Contato', ['contato@mutum.tec.br', 'WhatsApp', 'LinkedIn', 'GitHub']]].map(([h, items]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--mutum-coral)',
      marginBottom: 16
    }
  }, h), items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it,
    href: "#",
    style: {
      display: 'block',
      fontSize: 14,
      color: 'var(--mutum-bone)',
      textDecoration: 'none',
      padding: '5px 0'
    }
  }, it))))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 24,
      borderTop: '1px solid #34322E',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      color: '#877F73'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Mutum Tecnologia \xB7 Manaus, AM"), /*#__PURE__*/React.createElement("span", null, "Feito na floresta."))));
}
function App() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(Manifesto, null), /*#__PURE__*/React.createElement(FeaturedProduct, null), /*#__PURE__*/React.createElement(Portfolio, null), /*#__PURE__*/React.createElement(Where, null), /*#__PURE__*/React.createElement(CTA, null), /*#__PURE__*/React.createElement(Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web/app.jsx", error: String((e && e.message) || e) }); }

})();
