export function initTitleDrag() {
  const logo = document.querySelector(".title-logo");
  if (!logo) {
    return;
  }

  logo.draggable = false;
  logo.style.touchAction = "none";

  logo.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    const rect = logo.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    logo.style.left = `${rect.left}px`;
    logo.style.top = `${rect.top}px`;
    logo.style.transform = "none";

    const onMove = (moveEvent) => {
      logo.style.left = `${moveEvent.clientX - offsetX}px`;
      logo.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      logo.releasePointerCapture(event.pointerId);
    };

    logo.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}
