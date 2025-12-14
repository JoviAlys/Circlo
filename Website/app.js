const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("WebGL not supported");
}
gl.viewport(0, 0, canvas.width, canvas.height);

/* ================= SHADERS ================= */
const vertexShaderSource = `
    attribute vec2 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    uniform vec2 uTranslation;
    uniform float uScale;
    void main() {
        gl_Position = vec4(aPosition * uScale + uTranslation, 0.0, 1.0);
        vTexCoord = aTexCoord;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D uTexture;
    varying vec2 vTexCoord;
    void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
    }
`;

/* ================= SHADER UTILS ================= */
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

/* ================= COMPILE & LINK ================= */
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);
gl.useProgram(program);

/* ================= UNIFORMS & ATTRIBUTES ================= */
const translationLocation = gl.getUniformLocation(program, "uTranslation");
const scaleLocation = gl.getUniformLocation(program, "uScale");
const uTextureLocation = gl.getUniformLocation(program, "uTexture");

const positionLocation = gl.getAttribLocation(program, "aPosition");
const texCoordLocation = gl.getAttribLocation(program, "aTexCoord");

/* ================= GRID ITEMS ================= */
const gridRows = 2;
const gridCols = 3;
const itemSpacingX = 0.5;
const itemSpacingY = 0.5;
const startX = -0.5;
const startY = 0.25;

const imageFiles = [
    "images/shirt1.png",
    "images/shirt2.png",
    "images/shirt3.png",
    "images/shirt4.png",
    "images/shirt5.png",
    "images/shirt6.png"
];

const items = [];

for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
        const index = row * gridCols + col;
        if (index >= imageFiles.length) break;
        const x = startX + col * itemSpacingX;
        const y = startY - row * itemSpacingY;
        items.push({
            x,
            y,
            selected: false,
            scale: 1,
            hover: false,
            imgSrc: imageFiles[index],
            texture: null
        });
    }
}

/* ================= VERTEX BUFFER ================= */
const vertices = new Float32Array([
    // x, y, u, v
    -0.2, -0.2, 0.0, 0.0,
     0.2, -0.2, 1.0, 0.0,
    -0.2,  0.2, 0.0, 1.0,
     0.2,  0.2, 1.0, 1.0
]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Set up aPosition
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
// Set up aTexCoord
gl.enableVertexAttribArray(texCoordLocation);
gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

/* ================= LOAD TEXTURES ================= */
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    const image = new Image();
    image.src = url;
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
    return texture;
}

items.forEach(item => item.texture = loadTexture(gl, item.imgSrc));

/* ================= AUDIO ================= */
const audioContext = new AudioContext();

function loadSound(url) {
    return fetch(url).then(res => res.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data));
}

let clickSound, confirmSound, errorSound;
Promise.all([
    loadSound("audio/click.mp3"),
    loadSound("audio/confirm.mp3"),
    loadSound("audio/error.mp3")
]).then(([click, confirm, error]) => {
    clickSound = click;
    confirmSound = confirm;
    errorSound = error;
});

function playSound(buffer) {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
}

/* ================= MOUSE ================= */
function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / canvas.width) * 2 - 1;
    const y = ((rect.bottom - evt.clientY) / canvas.height) * 2 - 1;
    return { x, y };
}

canvas.addEventListener("mousemove", evt => {
    const pos = getMousePos(evt);
    items.forEach(item => {
        item.hover = pos.x > item.x - 0.2 && pos.x < item.x + 0.2 &&
                     pos.y > item.y - 0.2 && pos.y < item.y + 0.2;
    });
});

canvas.addEventListener("click", async evt => {
    if (audioContext.state === "suspended") await audioContext.resume();
    const pos = getMousePos(evt);
    items.forEach(item => {
        if (pos.x > item.x - 0.2 && pos.x < item.x + 0.2 &&
            pos.y > item.y - 0.2 && pos.y < item.y + 0.2) {
            item.selected = !item.selected;
            playSound(clickSound);
        }
    });
});

/* ================= SWAP BUTTON ================= */
document.getElementById("swapBtn").addEventListener("click", () => {
    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length > 0) {
        playSound(confirmSound);
        document.getElementById("status").innerText =
            `Swap request sent for ${selectedItems.length} item(s)!`;
        selectedItems.forEach(item => item.selected = false);
    } else {
        playSound(errorSound);
        document.getElementById("status").innerText =
            "Please select at least one item first.";
    }
});

/* ================= ANIMATE & RENDER ================= */
function animate() {
    items.forEach(item => {
        let baseScale = 1.0;
        if (item.hover) baseScale += 0.03;
        if (item.selected) item.scale = baseScale + 0.05 * Math.sin(Date.now() / 200);
        else item.scale = baseScale;
    });
    render();
    requestAnimationFrame(animate);
}

function render() {
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    items.forEach(item => {
        gl.uniform2fv(translationLocation, [item.x, item.y]);
        gl.uniform1f(scaleLocation, item.scale);

        // Bind the item’s texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, item.texture);
        gl.uniform1i(uTextureLocation, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
}

animate();
