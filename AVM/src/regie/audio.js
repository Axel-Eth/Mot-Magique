const selectSound = new Audio("sounds/selection_mot_grille.mp3");

export function playSelectSound() {
  try {
    selectSound.pause();
    selectSound.currentTime = 0;
    selectSound.play();
  } catch {}
}

export function stopSelectSound() {
  try {
    selectSound.pause();
    selectSound.currentTime = 0;
  } catch {}
}
