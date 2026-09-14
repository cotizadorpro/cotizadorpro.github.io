// ============================================================
// SUPABASE CATALOG - COTIZADOR PRO
// FUENTE NUEVA DE DATOS
// ============================================================

const SUPABASE_URL = "https://fnjayhjdpyurbfevkhpg.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Pqw59cE1lGrAbu23gRmchw_HcLRkhUO";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Disponible para el administrador
window.supabaseClient = supabaseClient;


// ============================================================
// CONFIGURACIÓN
// ============================================================

const SUPABASE_PAGE_SIZE = 1000;


// ============================================================
// CARGAR TODOS LOS REGISTROS DE UNA TABLA
// ============================================================

async function cargarTodosSupabase(tabla, select = "*") {

    let todos = [];
    let desde = 0;

    while (true) {

        const hasta = desde + SUPABASE_PAGE_SIZE - 1;

        const { data, error } = await supabaseClient
            .from(tabla)
            .select(select)
            .range(desde, hasta);

        if (error) {
            console.error(
                `❌ Error cargando tabla ${tabla}:`,
                error
            );

            throw error;
        }

        if (!data || data.length === 0) {
            break;
        }

        todos = todos.concat(data);

        if (data.length < SUPABASE_PAGE_SIZE) {
            break;
        }

        desde += SUPABASE_PAGE_SIZE;
    }

    return todos;
}


// CARGAR CATÁLOGO COMPLETO
// ============================================================

async function cargarCatalogoSupabase() {

    console.log("🔄 Cargando catálogo desde Supabase...");

    const [
        equipos,
        planes,
        planPlazos,
        vigencias,
        precios,
        servicios
    ] = await Promise.all([

        cargarTodosSupabase(
            "equipos",
            "*"
        ),

        cargarTodosSupabase(
            "planes",
            "*"
        ),

        cargarTodosSupabase(
            "plan_plazos",
            "*"
        ),

        cargarTodosSupabase(
            "vigencias",
            "*"
        ),

        cargarTodosSupabase(
            "precios",
            "*"
        ),

        cargarTodosSupabase(
            "servicios",
            "*"
        )

    ]);

    // ========================================================
    // FILTRAR REGISTROS ACTIVOS
    // ========================================================

    const equiposActivos = equipos.filter(
        equipo => equipo.activo === true
    );

    const planesActivos = planes.filter(
        plan => plan.activo === true
    );

    const plazosActivos = planPlazos.filter(
        plazo => plazo.activo === true
    );

    const preciosActivos = precios.filter(
        precio => precio.activo === true
    );

    const vigenciasActivas = vigencias.filter(
        vigencia => vigencia.activa === true
    );


    // ========================================================
    // ÍNDICES PARA BÚSQUEDA RÁPIDA
    // ========================================================

    const equiposPorId = new Map();

    const equiposPorCodigo = new Map();

    const planesPorId = new Map();

    const plazosPorId = new Map();

    const vigenciasPorId = new Map();


    equiposActivos.forEach(equipo => {

        equiposPorId.set(
            equipo.id,
            equipo
        );

        equiposPorCodigo.set(
            equipo.codigo,
            equipo
        );

    });


    planesActivos.forEach(plan => {

        planesPorId.set(
            plan.id,
            plan
        );

    });


    plazosActivos.forEach(plazo => {

        plazosPorId.set(
            plazo.id,
            plazo
        );

    });


    vigenciasActivas.forEach(vigencia => {

        vigenciasPorId.set(
            vigencia.id,
            vigencia
        );

    });


    // ========================================================
    // PRECIOS ENRIQUECIDOS
    // ========================================================

    const preciosEnriquecidos = preciosActivos.map(precio => {

        const equipo =
            equiposPorId.get(precio.equipo_id) || null;

        const plan =
            planesPorId.get(precio.plan_id) || null;

        const plazo =
            plazosPorId.get(precio.plazo_id) || null;

        const vigencia =
            vigenciasPorId.get(precio.vigencia_id) || null;


        return {

            ...precio,

            equipo: equipo,

            plan: plan,

            plazo: plazo,

            vigencia: vigencia,

            codigo:
                equipo?.codigo || null,

            equipo_nombre:
                equipo?.nombre || null,

            plan_codigo:
                plan?.codigo || null,

            plan_nombre:
                plan?.nombre || null,

            meses:
                plazo?.meses ?? null,

            vigencia_nombre:
                vigencia?.nombre || null,

            fecha_inicio:
                vigencia?.fecha_inicio || null,

            fecha_fin:
                vigencia?.fecha_fin || null

        };

    });


    // ========================================================
    // PRECIOS AGRUPADOS POR EQUIPO
    // ========================================================

    const preciosPorEquipo = new Map();


    preciosEnriquecidos.forEach(precio => {

        const equipoId = precio.equipo_id;

        if (!preciosPorEquipo.has(equipoId)) {
            preciosPorEquipo.set(
                equipoId,
                []
            );
        }

        preciosPorEquipo
            .get(equipoId)
            .push(precio);

    });


    // ========================================================
    // EQUIPOS ENRIQUECIDOS
    // ========================================================

    const equiposCompletos = equiposActivos.map(equipo => {

        const preciosEquipo =
            preciosPorEquipo.get(equipo.id) || [];


        return {

            ...equipo,

            precios:
                preciosEquipo,

            imagen:
                equipo.imagen_url || null,

            specs:
                equipo.especificaciones || {},

            argumentos:
                equipo.argumentos_venta || [],

            objeciones:
                equipo.objeciones || [],

            extra:
                equipo.datos_extra || {}

        };

    });


  // ========================================================
// OBJETO FINAL DEL CATÁLOGO
// ========================================================

const catalogo = {

    version: "supabase",

    fecha_carga:
        new Date().toISOString(),

    equipos:
        equiposCompletos,

    planes:
        planesActivos,

    plazos:
        plazosActivos,

    vigencias:
        vigenciasActivas,

    precios:
        preciosEnriquecidos,

    servicios:
        servicios,

    indices: {

        equiposPorId:
            equiposPorId,

        equiposPorCodigo:
            equiposPorCodigo,

        planesPorId:
            planesPorId,

        plazosPorId:
            plazosPorId,

        vigenciasPorId:
            vigenciasPorId,

        preciosPorEquipo:
            preciosPorEquipo

    }

};

    // ========================================================
    // DISPONIBLE GLOBALMENTE
    // ========================================================

    window.SUPABASE_CATALOGO =
        catalogo;


    window.EQUIPOS_SUPABASE =
        equiposCompletos;


    window.PLANES_SUPABASE =
        planesActivos;

    // --------------------------------------------------------
// COMPATIBILIDAD CON app.js
// app.js utiliza PLANS_DATA para mostrar los planes.
// Ahora la fuente oficial es Supabase.
// --------------------------------------------------------

window.PLANS_DATA = planesActivos.map(function(plan) {

    const extra = plan.datos_extra || {};

    return {
        name: plan.nombre,
        renta: plan.renta_mensual ??
               plan.renta ??
               extra.renta_mensual ??
               extra.renta ??
               0,

        color: plan.color ??
               extra.color ??
               '#667085',

        text: plan.text ??
              extra.text ??
              '#fff'
    };

});

console.log(
    "📋 PLANS_DATA:",
    window.PLANS_DATA
);
    


    window.PLAZOS_SUPABASE =
        plazosActivos;


    window.VIGENCIAS_SUPABASE =
        vigenciasActivas;


    window.PRECIOS_SUPABASE =
        preciosEnriquecidos;


    // ========================================================
    // RESUMEN
    // ========================================================

    console.log(
        "============================================"
    );

    console.log(
        "✅ CATÁLOGO SUPABASE CARGADO"
    );

    console.log(
        "============================================"
    );

    console.log(
        "📱 Equipos:",
        equiposActivos.length
    );

    console.log(
        "📋 Planes:",
        planesActivos.length
    );

    console.log(
        "📆 Plazos:",
        plazosActivos.length
    );

    console.log(
        "📅 Vigencias:",
        vigenciasActivas.length
    );

    console.log(
        "💰 Precios:",
        preciosActivos.length
    );

    console.log(
        "============================================"
    );


    return catalogo;
}

// ============================================================
// ADAPTADOR DE COMPATIBILIDAD
// Hace que app.js pueda seguir usando CAT / IMG / VIGENCY,
// pero ahora alimentados desde Supabase.
// ============================================================

function activarCatalogoSupabaseEnApp(catalogo) {

    const equipos = catalogo.equipos || [];
    const precios = catalogo.precios || [];
    const servicios = catalogo.servicios || [];

    // --------------------------------------------------------
    // SERVICIOS
    // --------------------------------------------------------

    const seguroAtt = servicios.find(function(servicio) {
        return String(servicio.codigo || "").toLowerCase() === "seguro_att"
            && servicio.activo !== false;
    });

    if (
        seguroAtt &&
        seguroAtt.configuracion &&
        Array.isArray(seguroAtt.configuracion.tiers)
    ) {
        window.SEGURO_TIERS = seguroAtt.configuracion.tiers;

        console.log(
            "🛡️ SEGURO_TIERS desde Supabase:",
            window.SEGURO_TIERS
        );
    } else {
        window.SEGURO_TIERS = [];

        console.warn(
            "⚠️ No se encontró configuración válida para seguro_att"
        );
    }

  // --------------------------------------------------------
// CONTROL DE DATOS
// --------------------------------------------------------

const controlDatos = servicios.find(function(servicio) {
    return String(servicio.codigo || "").toLowerCase() === "control_datos"
        && servicio.activo !== false;
});

if (controlDatos) {
    const config = controlDatos.configuracion || {};

    window.CONTROL_PRICE =
        Number(
            controlDatos.precio ??
            config.precio_fijo ??
            0
        ) || 0;

    console.log(
        "📶 CONTROL_PRICE desde Supabase:",
        window.CONTROL_PRICE
    );
} else {
    window.CONTROL_PRICE = 0;

    console.warn(
        "⚠️ No se encontró control_datos activo en Supabase"
    );
}
    // --------------------------------------------------------
    // CAT
    // --------------------------------------------------------

    const ios = [];
    const android = [];

    equipos.forEach(equipo => {

        const extra = equipo.datos_extra || {};

        const item = {
            id: equipo.codigo,
            name: equipo.nombre,
            brand: equipo.marca,
            storage: equipo.capacidad,

            status:
                extra.status ||
                (equipo.activo ? "RESURTIBLE" : "NO RESURTIBLE"),

            bundle:
                extra.bundle || null,

            specs:
                equipo.especificaciones || {},

            sell:
                equipo.argumentos_venta || [],

            obj:
                equipo.objeciones || []
        };

        if (
            String(equipo.marca || "").toUpperCase() === "APPLE"
        ) {
            ios.push(item);
        } else {
            android.push(item);
        }
    });


    // --------------------------------------------------------
    // IMG
    // --------------------------------------------------------

    const imagenes = {};

    equipos.forEach(equipo => {

        if (equipo.codigo && equipo.imagen_url) {

            imagenes[equipo.codigo] =
                equipo.imagen_url;

        }

    });


    // --------------------------------------------------------
    // VIGENCY
    // --------------------------------------------------------

    const vigencias = {};

    const preciosPorEquipo = {};

    precios.forEach(precio => {

        if (!preciosPorEquipo[precio.equipo_id]) {
            preciosPorEquipo[precio.equipo_id] = [];
        }

        preciosPorEquipo[precio.equipo_id].push(precio);

    });


    equipos.forEach(equipo => {

        const lista =
            preciosPorEquipo[equipo.id] || [];

        // Buscar una vigencia válida asociada
        // al equipo.

        const conVigencia =
            lista.find(p =>
                p.vigencia &&
                p.vigencia.fecha_fin
            );

        if (conVigencia) {

            vigencias[equipo.codigo] =
                conVigencia.vigencia.fecha_fin;

        } else {

            vigencias[equipo.codigo] =
                "indefinido";

        }

    });


    // --------------------------------------------------------
    // REEMPLAZAR LAS FUENTES GLOBALES ANTIGUAS
    // --------------------------------------------------------

    window.CAT = {
        ios: ios,
        android: android
    };

    window.IMG = imagenes;

    window.VIGENCY = vigencias;

        // --------------------------------------------------------
    // PRICES
    // Convertir precios de Supabase al formato que entiende app.js
    // --------------------------------------------------------

    const prices = {};
    const firstPlan = {};

    precios.forEach(precio => {

        const codigo = precio.codigo;

        if (!codigo) return;

        if (!prices[codigo]) {
            prices[codigo] = {
                contado: precio.precio_contado,
                planes: {}
            };
        }

        const planNombre =
            precio.plan_nombre ||
            precio.plan?.nombre;

        if (!planNombre) return;

        if (!prices[codigo].planes[planNombre]) {
            prices[codigo].planes[planNombre] = {};
        }

        prices[codigo].planes[planNombre][
            String(precio.meses)
        ] = precio.precio;

        if (!firstPlan[codigo]) {
            firstPlan[codigo] = planNombre;
        }
    });

    window.PRICES = prices;
    window.FIRST_PLAN = firstPlan;


    // --------------------------------------------------------
    // MARCA DE CONTROL
    // --------------------------------------------------------

    window.CATALOGO_FUENTE_ACTUAL =
        "SUPABASE";

    console.log(
        "🔄 App ahora usa catálogo SUPABASE"
    );

    console.log(
        "📱 CAT.ios:",
        ios.length
    );

    console.log(
        "🤖 CAT.android:",
        android.length
    );

    console.log(
        "🖼️ IMG:",
        Object.keys(imagenes).length
    );

    console.log(
        "📅 VIGENCY:",
        Object.keys(vigencias).length
    );


    // --------------------------------------------------------
    // REFRESCAR LAS VISTAS QUE YA EXISTEN
    // --------------------------------------------------------

    try {

        if (
            typeof renderDevs === "function"
        ) {
            renderDevs();
        }

    } catch (e) {

        console.warn(
            "[Supabase] renderDevs:",
            e
        );

    }


    try {

        if (
            typeof initMomento === "function"
        ) {
            initMomento();
        }

    } catch (e) {

        console.warn(
            "[Supabase] initMomento:",
            e
        );

    }


    try {

        if (
            typeof renderFlashCard === "function"
        ) {
            renderFlashCard();
        }

    } catch (e) {

        console.warn(
            "[Supabase] renderFlashCard:",
            e
        );

    }
}

// ============================================================
// PROMESA GLOBAL DE CARGA
// ============================================================

window.SUPABASE_CATALOGO_READY =
    cargarCatalogoSupabase()
       .then(catalogo => {

    // 🔥 NUEVO: pasar Supabase al formato que entiende app.js
    activarCatalogoSupabaseEnApp(catalogo);

    console.log(
        "🚀 Supabase Catalog READY"
    );

    console.log(
        "📱 EQUIPOS DISPONIBLES:",
        catalogo.equipos.length
    );

    console.log(
        "🔎 PRIMER EQUIPO:",
        catalogo.equipos[0]
    );

    return catalogo;

})

        .catch(error => {

            console.error(
                "❌ Error cargando catálogo Supabase:",
                error
            );

            throw error;

        });
