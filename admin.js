(function(){
'use strict';
const db=window.supabaseClient;
const ADMIN_FUNCTION='smart-worker';
const ADMIN_SECRET_KEY='cotizador_admin_secret_v1';

function getAdminSecret(){
    let secret=sessionStorage.getItem(ADMIN_SECRET_KEY)||'';
    if(!secret){
        secret=prompt('Ingresa la clave de administrador:')||'';
        if(secret) sessionStorage.setItem(ADMIN_SECRET_KEY,secret);
    }
    return secret;
}

async function adminCall(action,table,options={}){
    const secret=getAdminSecret();
    if(!secret) throw new Error('No se ingresó la clave de administrador.');

    const body={
        action,
        table,
        ...(options.payload!==undefined?{payload:options.payload}:{}),
        ...(options.id!==undefined?{id:options.id}:{}),
        ...(options.filters!==undefined?{filters:options.filters}:{})
    };

    const {data,error}=await db.functions.invoke(ADMIN_FUNCTION,{
        body,
        headers:{'x-admin-secret':secret}
    });

    if(error){
        throw new Error(error.message||'Error llamando a smart-worker.');
    }
    if(data && data.error){
        if(String(data.error).toLowerCase().includes('no autorizado')){
            sessionStorage.removeItem(ADMIN_SECRET_KEY);
        }
        throw new Error(data.error);
    }
    return data;
}
const $=id=>document.getElementById(id);
let DATA={equipos:[],planes:[],plazos:[],vigencias:[],precios:[],servicios:[]};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const val=id=>($(id)?.value??'').trim();
const num=id=>val(id)===''?null:Number(val(id));
const lines=id=>val(id).split('\n').map(x=>x.trim()).filter(Boolean);
const jsonParse=(s,fallback={})=>{try{return s.trim()?JSON.parse(s):fallback}catch(e){throw new Error('JSON inválido: '+e.message)}};
function msg(text,type='success'){const e=$('estado');e.className='status '+type;e.textContent=text}
async function all(table){let out=[],from=0;while(true){const {data,error}=await db.from(table).select('*').range(from,from+999);if(error)throw error;if(!data?.length)break;out.push(...data);if(data.length<1000)break;from+=1000}return out}
async function reload(){msg('Actualizando catálogo…','');const [equipos,planes,plazos,vigencias,precios,servicios]=await Promise.all(['equipos','planes','plan_plazos','vigencias','precios','servicios'].map(all));DATA={equipos,planes,plazos,vigencias,precios,servicios};renderAll();msg(`✓ ${equipos.length} equipos · ${planes.length} planes · ${precios.length} precios`,'success')}
function renderAll(){renderEquipos();renderPlanes();renderServicios();ocultarPestanaVigencias()}
function badge(on){return `<span class="badge ${on?'on':'off'}">${on?'Disponible':'No disponible'}</span>`}
function renderEquipos(){const q=val('buscarEquipo').toLowerCase();const arr=DATA.equipos.filter(e=>!q||[e.codigo,e.nombre,e.marca,e.capacidad].some(x=>String(x||'').toLowerCase().includes(q))).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre)));$('listaEquipos').innerHTML=arr.map(e=>`<div class="item">${e.imagen_url?`<img class="thumb" src="${esc(e.imagen_url)}" alt="">`:`<div class="thumb"></div>`}<div class="grow"><strong>${esc(e.nombre||e.codigo)}</strong><div class="meta">${esc(e.marca||'')} · ${esc(e.capacidad||'')} · ${esc(e.codigo||'')}</div><div style="margin-top:7px">${badge(e.activo!==false)}</div></div><div class="row"><button class="primary" onclick="editarEquipo('${esc(e.id)}')">Editar</button><button class="${e.activo!==false?'danger':'ok'}" onclick="toggleEquipo('${esc(e.id)}',${e.activo===false})">${e.activo!==false?'Desactivar':'Activar'}</button></div></div>`).join('')||'<div class="card">No se encontraron equipos.</div>'}
function renderPlanes(){$('listaPlanes').innerHTML=DATA.planes.sort((a,b)=>(a.orden??999)-(b.orden??999)).map(p=>`<div class="item"><div class="grow"><strong>${esc(p.nombre)}</strong><div class="meta">${esc(p.codigo)} · Renta: $${esc(p.renta_mensual??p.renta??p.datos_extra?.renta_mensual??0)}</div><div style="margin-top:7px">${badge(p.activo!==false)}</div></div><button class="primary" onclick="editarPlan('${esc(p.id)}')">Editar</button></div>`).join('')}
function renderServicios(){$('listaServicios').innerHTML=DATA.servicios.map(s=>`<div class="item"><div class="grow"><strong>${esc(s.nombre||s.codigo)}</strong><div class="meta">${esc(s.codigo)}${s.precio!=null?' · $'+esc(s.precio):''}</div><div style="margin-top:7px">${badge(s.activo!==false)}</div></div><button class="primary" onclick="editarServicio('${esc(s.id)}')">Editar</button></div>`).join('')}
function renderVigencias(){$('listaVigencias').innerHTML=DATA.vigencias.map(v=>`<div class="item"><div class="grow"><strong>${esc(v.nombre||'Vigencia')}</strong><div class="meta">${esc(v.fecha_inicio||'—')} → ${esc(v.fecha_fin||'indefinido')}</div><div style="margin-top:7px">${badge(v.activa!==false)}</div></div><button class="primary" onclick="editarVigencia('${esc(v.id)}')">Editar</button></div>`).join('')}
function open(title,html){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modal').classList.remove('hidden')}
window.cerrarModal=()=>{$('modal').classList.add('hidden');$('modalBody').innerHTML=''};
function field(label,id,value='',type='text',extra=''){return `<div><label>${label}</label><input id="${id}" type="${type}" value="${esc(value??'')}" ${extra}></div>`}
function textarea(label,id,value='',hint=''){return `<div><label>${label}</label><textarea id="${id}">${esc(value??'')}</textarea>${hint?`<div class="note">${hint}</div>`:''}</div>`}
function normalizarListaEditor(lista){
    if(!Array.isArray(lista)) return [];
    return lista.map(function(item){
        if(typeof item === 'string') return item;
        if(item == null) return '';
        try{return JSON.stringify(item)}catch(e){return String(item)}
    }).filter(Boolean);
}
function parseListaEditor(id){
    return lines(id).map(function(item){
        const t=item.trim();
        if((t.startsWith('{')&&t.endsWith('}'))||(t.startsWith('[')&&t.endsWith(']'))){
            try{return JSON.parse(t)}catch(e){}
        }
        return t;
    });
}
function objecionesToLines(lista){
    if(!Array.isArray(lista)) return '';
    return lista.map(function(item){
        if(typeof item === 'string') return item;
        if(item && typeof item === 'object'){
            if('a' in item || 'q' in item){
                const a = item.a ?? '';
                const q = item.q ?? '';
                if(a && q) return 'Pregunta: ' + q + ' | Respuesta: ' + a;
                if(a) return 'Respuesta: ' + a;
                if(q) return 'Pregunta: ' + q;
            }
            return Object.values(item).filter(v=>v!=null && v!=='').join(' | ');
        }
        return '';
    }).filter(Boolean).join('\n');
}
function parseObjecionesEditor(id){
    return lines(id).map(function(linea){
        const sepR=' | Respuesta: ';
        const sepP=' | Pregunta: ';
        if(linea.startsWith('Pregunta: ')){
            const cuerpo=linea.slice('Pregunta: '.length);
            const pos=cuerpo.indexOf(sepR);
            if(pos>=0) return {q:cuerpo.slice(0,pos).trim(),a:cuerpo.slice(pos+sepR.length).trim()};
            return {q:cuerpo.trim(),a:''};
        }
        if(linea.startsWith('Respuesta: ')){
            const cuerpo=linea.slice('Respuesta: '.length);
            const pos=cuerpo.indexOf(sepP);
            if(pos>=0) return {a:cuerpo.slice(0,pos).trim(),q:cuerpo.slice(pos+sepP.length).trim()};
            return {a:cuerpo.trim(),q:''};
        }
        return linea;
    });
}
function specsToLines(specs){
    if(!specs || typeof specs !== 'object' || Array.isArray(specs)) return '';
    return Object.entries(specs).map(function([clave,valor]){
        if(valor == null || valor === '') return clave;
        if(typeof valor === 'object'){
            try{return clave + ': ' + JSON.stringify(valor)}catch(e){return clave + ': ' + String(valor)}
        }
        return clave + ': ' + valor;
    }).join('\n');
}
function parseSpecsLines(id){
    const resultado = {};
    lines(id).forEach(function(linea,indice){
        const pos = linea.indexOf(':');
        if(pos > 0){
            const clave = linea.slice(0,pos).trim();
            const valor = linea.slice(pos+1).trim();
            if(clave) resultado[clave] = valor;
        } else {
            resultado['Característica ' + (indice + 1)] = linea;
        }
    });
    return resultado;
}

function vigenciasIdsEquipo(equipoId){
    const ids=[];

    // Relación directa guardada en datos_extra del equipo.
    const equipo=DATA.equipos.find(e=>e.id===equipoId);
    const directa=equipo?.datos_extra?.vigencia_id;
    if(directa) ids.push(directa);

    // Compatibilidad con precios existentes.
    DATA.precios
        .filter(p=>p.equipo_id===equipoId && p.vigencia_id)
        .forEach(p=>ids.push(p.vigencia_id));

    return [...new Set(ids.filter(Boolean))];
}

function vigenteHastaEquipo(equipoId){
    const ids=vigenciasIdsEquipo(equipoId);
    for(const id of ids){
        const v=DATA.vigencias.find(x=>x.id===id);
        if(v?.fecha_fin) return String(v.fecha_fin).slice(0,10);
    }
    return '';
}

function ocultarPestanaVigencias(){
    const tab=document.querySelector('.tab[data-tab="vigencias"]');
    if(tab) tab.style.display='none';
    const sec=document.getElementById('sec-vigencias');
    if(sec) sec.style.display='none';
}

async function guardarVigenciaEquipo(equipoId,fechaFin){
    const equipo=DATA.equipos.find(e=>e.id===equipoId);
    if(!equipo) throw new Error('No se encontró el equipo.');

    let vigenciaId=equipo?.datos_extra?.vigencia_id || null;
    const nombreVigencia='Vigencia '+String(equipo.codigo||'').trim();

    // Si el equipo aún no tiene una vigencia vinculada, primero buscamos
    // una vigencia existente con el nombre estándar para evitar duplicados.
    if(!vigenciaId){
        const existente=DATA.vigencias.find(v=>
            String(v?.nombre||'').trim().toLowerCase()===nombreVigencia.toLowerCase()
        );

        if(existente?.id){
            vigenciaId=existente.id;
        }else{
            // Equipo nuevo: crear automáticamente su vigencia.
            const hoy=new Date().toISOString().slice(0,10);
            const creada=await adminCall('insert','vigencias',{
                payload:{
                    nombre:nombreVigencia,
                    fecha_inicio:hoy,
                    fecha_fin:fechaFin||null,
                    activa:true
                }
            });

            vigenciaId=creada?.data?.[0]?.id||'';
            if(!vigenciaId){
                throw new Error('Se guardó el equipo, pero no se pudo crear su vigencia automática.');
            }

            DATA.vigencias.push({
                id:vigenciaId,
                nombre:nombreVigencia,
                fecha_inicio:hoy,
                fecha_fin:fechaFin||null,
                activa:true
            });
        }

        // Vincular la vigencia al equipo para que futuras ediciones sean directas.
        const extraFinal={
            ...(equipo.datos_extra||{}),
            vigencia_id:vigenciaId
        };

        await adminCall('update','equipos',{
            id:equipoId,
            payload:{datos_extra:extraFinal}
        });

        equipo.datos_extra=extraFinal;
    }

    // Guardar/actualizar la fecha elegida.
    await adminCall('update','vigencias',{
        id:vigenciaId,
        payload:{
            fecha_fin:fechaFin||null,
            activa:true
        }
    });

    const vigencia=DATA.vigencias.find(v=>v.id===vigenciaId);
    if(vigencia){
        vigencia.fecha_fin=fechaFin||null;
        vigencia.activa=true;
    }

    return vigenciaId;
}

function equipoForm(e,isNew){
    const specs=specsToLines(e?.especificaciones||{});
    const sell=normalizarListaEditor(e?.argumentos_venta).join('\n');
    const obj=objecionesToLines(e?.objeciones||[]);
    const statusComercial=e?.datos_extra?.status || (e?.activo!==false?'RESURTIBLE':'NO RESURTIBLE');
    const bundleActual=String(e?.datos_extra?.bundle||'').trim();
    const tieneBundle=!!bundleActual;
    const vigenteHasta=e?.id?vigenteHastaEquipo(e.id):'';

    let html=`<div class="grid">
        ${field('Código','eq_codigo',e?.codigo||'', 'text',isNew?'':'readonly')}
        ${field('Nombre','eq_nombre',e?.nombre||'')}
        ${field('Marca','eq_marca',e?.marca||'')}
        ${field('Capacidad','eq_capacidad',e?.capacidad||'')}

        <div>
            <label>Estado en catálogo</label>
            <select id="eq_activo">
                <option value="1" ${e?.activo!==false?'selected':''}>Disponible</option>
                <option value="0" ${e?.activo===false?'selected':''}>No disponible</option>
            </select>
        </div>

        <div>
            <label>Status comercial en cotización</label>
            <select id="eq_status">
                <option value="RESURTIBLE" ${statusComercial==='RESURTIBLE'?'selected':''}>RESURTIBLE</option>
                <option value="NO RESURTIBLE" ${statusComercial==='NO RESURTIBLE'?'selected':''}>NO RESURTIBLE</option>
            </select>
        </div>

        ${field('Vigente hasta','eq_vigente_hasta',vigenteHasta,'date')}
        ${field('URL de imagen','eq_imagen',e?.imagen_url||'')}

        <div>
            <label>Bundle del fabricante</label>
            <select id="eq_bundle_activo" onchange="toggleBundleUI()">
                <option value="0" ${!tieneBundle?'selected':''}>No</option>
                <option value="1" ${tieneBundle?'selected':''}>Sí</option>
            </select>
            <div class="note">Actívalo solo cuando el equipo incluya un regalo directo del fabricante.</div>
        </div>

        <div id="eq_bundle_wrap" style="${tieneBundle?'':'display:none'}">
            <label>Regalo incluido en Bundle</label>
            <input id="eq_bundle" type="text" value="${esc(bundleActual)}" placeholder="Ej. Incluye Bocina Xiaomi Sound Outdoor">
            <div class="note">Este texto aparecerá en el recuadro Bundle del cotizador.</div>
        </div>
    </div>

    <div class="subcard">
        <h3>Imagen</h3>
        <div class="row">
            <input id="eq_file" type="file" accept="image/*" style="max-width:430px">
            <button onclick="subirImagenEquipo('${esc(e?.id||'')}')">Subir imagen</button>
            ${e?.imagen_url?`<img class="preview" src="${esc(e.imagen_url)}">`:''}
        </div>
        <div class="note">Se sube al bucket <b>equipos</b> y se guarda la URL automáticamente.</div>
    </div>

    <div class="grid">
        ${textarea('Características (una por línea)','eq_specs',specs,'Puedes escribir por ejemplo: Pantalla: AMOLED 6.9&quot; o simplemente una característica por línea.')}
        ${textarea('Argumentos de venta (uno por línea)','eq_sell',sell)}
        ${textarea('Objeciones (una por línea)','eq_obj',obj,'Se mostrará igual que en el cotizador: Pregunta: ... | Respuesta: ...')}
    </div>

    <div class="row" style="margin-top:18px">
        <button class="primary" onclick="guardarEquipo('${esc(e?.id||'')}')">💾 Guardar equipo</button>
        ${!isNew?`<button class="danger" onclick="eliminarEquipo('${esc(e.id)}')">Eliminar definitivamente</button>`:''}
    </div>`;

    if(!isNew) html+=preciosForm(e);
    return html;
}

window.toggleBundleUI=function(){
    const activo=val('eq_bundle_activo')==='1';
    const wrap=$('eq_bundle_wrap');
    if(wrap) wrap.style.display=activo?'':'none';
    if(!activo){
        const input=$('eq_bundle');
        if(input) input.value='';
    }
};

function preciosForm(e){const ep=DATA.precios.filter(x=>x.equipo_id===e.id);const contado=ep.find(x=>x.precio_contado!=null)?.precio_contado??'';let h=`<div class="subcard"><h3>💰 Precios</h3>${field('Precio de contado','eq_contado',contado,'number','step="0.01"')}<div class="price-grid" style="margin-top:14px"><div class="price-head">Plan</div>${[24,30,36].map(m=>`<div class="price-head">${m} meses</div>`).join('')}`;for(const p of DATA.planes.filter(x=>x.activo!==false)){h+=`<div><strong>${esc(p.nombre)}</strong></div>`;for(const m of [24,30,36]){const plazo=DATA.plazos.find(x=>Number(x.meses)===m);const row=ep.find(x=>x.plan_id===p.id&&x.plazo_id===plazo?.id);h+=`<div><input class="price-input" data-plan="${esc(p.id)}" data-plazo="${esc(plazo?.id||'')}" data-row="${esc(row?.id||'')}" type="number" step="0.01" value="${esc(row?.precio??'')}" placeholder="—"></div>`}}h+=`</div><div class="row" style="margin-top:14px"><button class="primary" onclick="guardarPrecios('${esc(e.id)}')">Guardar precios</button></div></div>`;return h}
window.nuevoEquipo=()=>open('Agregar equipo',equipoForm(null,true));
window.editarEquipo=id=>{const e=DATA.equipos.find(x=>x.id===id);if(e)open('Editar equipo',equipoForm(e,false))};
window.guardarEquipo=async id=>{try{
const codigo=val('eq_codigo'),nombre=val('eq_nombre');
if(!codigo||!nombre)throw new Error('Código y nombre son obligatorios.');

const actual=id?DATA.equipos.find(x=>x.id===id):null;
const bundleActivo=val('eq_bundle_activo')==='1';
const bundleTexto=bundleActivo ? val('eq_bundle').trim() : '';

if(bundleActivo && !bundleTexto){
    throw new Error('Si activas Bundle, escribe qué regalo incluye.');
}

const datosExtra={
    ...(actual?.datos_extra||{}),
    status:val('eq_status')||'RESURTIBLE',
    bundle:bundleActivo ? bundleTexto : null
};

const payload={
    codigo,
    nombre,
    marca:val('eq_marca'),
    capacidad:val('eq_capacidad'),
    activo:val('eq_activo')==='1',
    imagen_url:val('eq_imagen')||null,
    especificaciones:parseSpecsLines('eq_specs'),
    argumentos_venta:parseListaEditor('eq_sell'),
    objeciones:parseObjecionesEditor('eq_obj'),
    datos_extra:datosExtra
};

let equipoId=id;

if(id){
    await adminCall('update','equipos',{id,payload});
}else{
    const creado=await adminCall('insert','equipos',{payload});
    equipoId=creado?.data?.[0]?.id||'';
}

if(equipoId){
    if(!DATA.equipos.some(e=>e.id===equipoId)){
        DATA.equipos.push({id:equipoId,...payload});
    }

    const vigenciaId=await guardarVigenciaEquipo(
        equipoId,
        val('eq_vigente_hasta')||null
    );

    // La relación equipo → vigencia ya está guardada en datos_extra.
    // No hacemos una segunda escritura innecesaria sobre equipos.
}

await reload();
cerrarModal();
msg('✓ Equipo y vigencia guardados de forma segura','success');
}catch(e){
    alert('No se pudo guardar: '+(e.message||e));
}};

window.toggleEquipo=async(id,activar)=>{if(!confirm(activar?'¿Activar este equipo?':'¿Desactivar este equipo? No aparecerá en el cotizador.'))return;try{await adminCall('update','equipos',{id,payload:{activo:activar}});await reload()}catch(e){alert('No se pudo cambiar el estado: '+e.message)}};

window.eliminarEquipo=async id=>{const e=DATA.equipos.find(x=>x.id===id);if(!confirm(`ELIMINAR definitivamente ${e?.nombre||''}?\n\nSe borrarán también sus precios. Esta acción no se puede deshacer.`))return;try{await adminCall('delete_filters','precios',{filters:{equipo_id:id}});await adminCall('delete','equipos',{id});await reload();cerrarModal()}catch(e){alert('No se pudo eliminar: '+e.message)}};

window.subirImagenEquipo=async id=>{try{
if(!id)throw new Error('Primero guarda el equipo antes de subir su imagen.');
const input=$('eq_file'),file=input?.files?.[0];
if(!file)throw new Error('Selecciona una imagen primero.');
if(!file.type?.startsWith('image/'))throw new Error('El archivo seleccionado no es una imagen.');
if(file.size>8*1024*1024)throw new Error('La imagen es demasiado grande. Máximo 8 MB.');
const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
const equipo=DATA.equipos.find(x=>x.id===id);
const codigo=(equipo?.codigo||id).toLowerCase().replace(/[^a-z0-9_-]/g,'-');
const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
const resp=await adminCall('upload_image','equipos',{payload:{equipo_id:id,codigo,extension:ext,content_type:file.type,base64:btoa(binary)}});
const url=resp?.url||resp?.data?.url;if(!url)throw new Error('La función no devolvió la URL de la imagen.');
await reload();const actualizado=DATA.equipos.find(x=>x.id===id);if(actualizado)open('Editar equipo',equipoForm(actualizado,false));
alert('Imagen subida y guardada correctamente.');
}catch(e){alert('No se pudo subir la imagen: '+(e.message||e))}};

window.guardarPrecios=async equipoId=>{try{
    const contado=num('eq_contado');

    if(contado===null || !Number.isFinite(contado) || contado<0){
        throw new Error('Ingresa un precio de contado válido.');
    }

    const inputs=[...document.querySelectorAll('.price-input')];
    const vigenciaId=vigenciasIdsEquipo(equipoId)[0] || null;

    for(const i of inputs){
        const planId=i.dataset.plan;
        const plazoId=i.dataset.plazo;
        if(!planId || !plazoId) continue;

        const raw=i.value.trim();
        const precio=raw==='' ? null : Number(raw);

        if(precio!==null && (!Number.isFinite(precio) || precio<0)){
            throw new Error('Hay un precio inválido en la tabla.');
        }

        const existentes=DATA.precios.filter(p=>
            p.equipo_id===equipoId &&
            p.plan_id===planId &&
            p.plazo_id===plazoId
        );

        // Campo vacío = esa combinación no debe existir.
        if(precio===null){
            for(const row of existentes){
                await adminCall('delete','precios',{id:row.id});
            }
            continue;
        }

        if(existentes.length){
            // Reutilizar un único registro.
            await adminCall('update','precios',{
                id:existentes[0].id,
                payload:{
                    precio,
                    precio_contado:contado,
                    activo:true,
                    ...(vigenciaId?{vigencia_id:vigenciaId}:{})
                }
            });

            // Si hubiera residuos/duplicados, eliminarlos.
            for(const extra of existentes.slice(1)){
                await adminCall('delete','precios',{id:extra.id});
            }
        }else{
            await adminCall('insert','precios',{
                payload:{
                    equipo_id:equipoId,
                    plan_id:planId,
                    plazo_id:plazoId,
                    precio,
                    precio_contado:contado,
                    activo:true,
                    ...(vigenciaId?{vigencia_id:vigenciaId}:{})
                }
            });
        }
    }

    await reload();

    // Reabrir el editor ya actualizado.
    const equipo=DATA.equipos.find(x=>x.id===equipoId);
    if(equipo) open('Editar equipo',equipoForm(equipo,false));

    alert('Precios guardados correctamente. Cada plan y plazo conserva un solo registro.');
}catch(e){
    console.error('[guardarPrecios]',e);
    alert('No se pudieron guardar precios: '+(e.message||e));
}};

function planForm(p){const extra=JSON.stringify(p?.datos_extra||{},null,2);const renta=p?.renta_mensual??p?.renta??p?.datos_extra?.renta_mensual??'';return `<div class="grid">${field('Código','pl_codigo',p?.codigo||'', 'text',p?'readonly':'')}${field('Nombre','pl_nombre',p?.nombre||'')}${field('Renta mensual','pl_renta',renta,'number','step="0.01"')}${field('Orden','pl_orden',p?.orden??'','number')}<div><label>Estado</label><select id="pl_activo"><option value="1" ${p?.activo!==false?'selected':''}>Activo</option><option value="0" ${p?.activo===false?'selected':''}>Inactivo</option></select></div></div>${textarea('Datos extra (JSON)','pl_extra',extra)}<div class="row" style="margin-top:15px"><button class="primary" onclick="guardarPlan('${esc(p?.id||'')}')">Guardar plan</button>${p?`<button class="danger" onclick="eliminarPlan('${esc(p.id)}')">Eliminar</button>`:''}</div>`}
window.nuevoPlan=()=>open('Agregar plan',planForm(null));window.editarPlan=id=>{const p=DATA.planes.find(x=>x.id===id);if(p)open('Editar plan',planForm(p))};
window.guardarPlan=async id=>{try{const extra=jsonParse(val('pl_extra'),{});const renta=num('pl_renta');if(renta!==null)extra.renta_mensual=renta;const payload={codigo:val('pl_codigo'),nombre:val('pl_nombre'),activo:val('pl_activo')==='1',datos_extra:extra};if(val('pl_orden')!=='')payload.orden=Number(val('pl_orden'));if(id)await adminCall('update','planes',{id,payload});else await adminCall('insert','planes',{payload});await reload();cerrarModal()}catch(e){alert('No se pudo guardar el plan: '+e.message)}};

window.eliminarPlan=async id=>{if(!confirm('¿Eliminar definitivamente este plan? Si tiene precios relacionados, Supabase puede impedirlo. Es más seguro desactivarlo.'))return;try{await adminCall('delete','planes',{id});await reload();cerrarModal()}catch(e){alert('No se pudo eliminar el plan: '+e.message)}};
function servicioForm(s){return `<div class="grid">${field('Código','sv_codigo',s?.codigo||'', 'text',s?'readonly':'')}${field('Nombre','sv_nombre',s?.nombre||'')}${field('Precio','sv_precio',s?.precio??'','number','step="0.01"')}<div><label>Estado</label><select id="sv_activo"><option value="1" ${s?.activo!==false?'selected':''}>Activo</option><option value="0" ${s?.activo===false?'selected':''}>Inactivo</option></select></div></div>${textarea('Configuración (JSON)','sv_config',JSON.stringify(s?.configuracion||{},null,2),'Seguro AT&T usa tiers; Control de Datos puede usar precio_fijo.')}<div class="row" style="margin-top:15px"><button class="primary" onclick="guardarServicio('${esc(s?.id||'')}')">Guardar servicio</button>${s?`<button class="danger" onclick="eliminarServicio('${esc(s.id)}')">Eliminar</button>`:''}</div>`}
window.nuevoServicio=()=>open('Agregar servicio',servicioForm(null));window.editarServicio=id=>{const s=DATA.servicios.find(x=>x.id===id);if(s)open('Editar servicio',servicioForm(s))};
window.guardarServicio=async id=>{try{const payload={codigo:val('sv_codigo'),nombre:val('sv_nombre'),precio:num('sv_precio'),activo:val('sv_activo')==='1',configuracion:jsonParse(val('sv_config'),{})};if(id)await adminCall('update','servicios',{id,payload});else await adminCall('insert','servicios',{payload});await reload();cerrarModal()}catch(e){alert('No se pudo guardar el servicio: '+e.message)}};window.eliminarServicio=async id=>{if(!confirm('¿Eliminar este servicio?'))return;try{await adminCall('delete','servicios',{id});await reload();cerrarModal()}catch(e){alert('No se pudo eliminar el servicio: '+e.message)}};
function vigForm(v){return `<div class="grid">${field('Nombre','vg_nombre',v?.nombre||'')}${field('Fecha inicio','vg_ini',v?.fecha_inicio||'','date')}${field('Fecha fin','vg_fin',v?.fecha_fin||'','date')}<div><label>Estado</label><select id="vg_activa"><option value="1" ${v?.activa!==false?'selected':''}>Activa</option><option value="0" ${v?.activa===false?'selected':''}>Inactiva</option></select></div></div><div class="row" style="margin-top:15px"><button class="primary" onclick="guardarVigencia('${esc(v?.id||'')}')">Guardar vigencia</button></div>`}
window.editarVigencia=id=>{const v=DATA.vigencias.find(x=>x.id===id);if(v)open('Editar vigencia',vigForm(v))};window.guardarVigencia=async id=>{try{const payload={nombre:val('vg_nombre'),fecha_inicio:val('vg_ini')||null,fecha_fin:val('vg_fin')||null,activa:val('vg_activa')==='1'};await adminCall('update','vigencias',{id,payload});await reload();cerrarModal()}catch(e){alert('No se pudo guardar la vigencia: '+e.message)}};

$('buscarEquipo').addEventListener('input',renderEquipos);document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.section').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('sec-'+b.dataset.tab).classList.add('on')});
ocultarPestanaVigencias();reload().catch(e=>{console.error(e);msg('ERROR: '+(e.message||e),'danger')});
})();
