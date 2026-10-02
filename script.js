// Buscamos el botón y el mensaje en el HTML.
const boton = document.getElementById("boton-saludo");
const mensaje = document.getElementById("mensaje");

// Cambiamos el texto cuando se pulsa el botón.
boton.addEventListener("click", function () {
  mensaje.textContent = "¡Hola! Tu JavaScript funciona correctamente 😊";
});
