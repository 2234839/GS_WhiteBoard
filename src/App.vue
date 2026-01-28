<script setup lang="ts">
import Whiteboard from './components/Whiteboard.vue'
</script>

<template>
  <div class="app">
    <Whiteboard />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app {
  width: 100vw;
  height: 100vh;
  background: #f5f5f5;
}
</style>
