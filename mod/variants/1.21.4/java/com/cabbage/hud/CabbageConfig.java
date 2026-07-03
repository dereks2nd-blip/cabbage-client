package com.cabbage.hud;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Persisted HUD config: per-element enabled flag + position. Saved to config/cabbage-hud.json. */
public class CabbageConfig {

    public static class Elem {
        public boolean enabled = true;
        public int x;
        public int y;

        public Elem() {
        }

        public Elem(boolean enabled, int x, int y) {
            this.enabled = enabled;
            this.x = x;
            this.y = y;
        }
    }

    public Map<String, Elem> elements = new LinkedHashMap<>();

    /** Editor menu panel position (draggable via its header). */
    public int panelX = 6;
    public int panelY = 6;

    /** ESP toggles (off by default — see CabbageEsp for the ban warning). */
    public boolean playerEsp = false;
    public boolean blockEsp = false;

    /** Which ore types block-ESP highlights, keyed by CabbageEsp.Ore.key. */
    public Map<String, Boolean> espBlocks = new LinkedHashMap<>();

    public boolean espBlockEnabled(String key, boolean def) {
        Boolean v = espBlocks.get(key);
        return v == null ? def : v;
    }

    public void setEspBlock(String key, boolean value) {
        espBlocks.put(key, value);
    }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static CabbageConfig instance;

    private static Path path() {
        return FabricLoader.getInstance().getConfigDir().resolve("cabbage-hud.json");
    }

    public static CabbageConfig get() {
        if (instance == null) {
            instance = load();
        }
        return instance;
    }

    /** Get (creating with defaults on first use) the state for an element id. */
    public Elem elem(String id, int defaultX, int defaultY) {
        return elements.computeIfAbsent(id, k -> new Elem(true, defaultX, defaultY));
    }

    private static CabbageConfig load() {
        try {
            Path p = path();
            if (Files.exists(p)) {
                CabbageConfig c = GSON.fromJson(Files.readString(p), CabbageConfig.class);
                if (c != null) {
                    if (c.elements == null) {
                        c.elements = new LinkedHashMap<>();
                    }
                    if (c.espBlocks == null) {
                        c.espBlocks = new LinkedHashMap<>();
                    }
                    return c;
                }
            }
        } catch (Exception ignored) {
        }
        return new CabbageConfig();
    }

    public void save() {
        try {
            Files.writeString(path(), GSON.toJson(this));
        } catch (Exception ignored) {
        }
    }
}
