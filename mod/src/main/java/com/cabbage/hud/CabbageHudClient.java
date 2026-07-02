package com.cabbage.hud;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

import java.util.List;

/**
 * Cabbage HUD v2 — a Lunar/Feather-style overlay with an in-game editor.
 * Press the editor key (default Right Shift) to toggle elements on/off and drag
 * them around. Elements: FPS, coords, direction, CPS, keystrokes, armor.
 */
public class CabbageHudClient implements ClientModInitializer {

    public static final List<CabbageElements.HudElement> ELEMENTS = CabbageElements.all();

    private KeyBinding editorKey;
    private boolean prevAttack;
    private boolean prevUse;

    @Override
    public void onInitializeClient() {
        editorKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.cabbage-hud.editor",
                InputUtil.Type.KEYSYM,
                GLFW.GLFW_KEY_RIGHT_SHIFT,
                KeyBinding.Category.MISC
        ));

        HudRenderCallback.EVENT.register((ctx, tick) -> {
            MinecraftClient mc = MinecraftClient.getInstance();
            if (mc.player == null) {
                return;
            }
            // ESP renders even with the HUD hidden (F1) — nice for clean footage.
            CabbageEsp.render(ctx, mc, tick.getTickProgress(false));
            if (mc.options.hudHidden) {
                return;
            }
            CabbageConfig cfg = CabbageConfig.get();
            for (CabbageElements.HudElement el : ELEMENTS) {
                CabbageConfig.Elem st = cfg.elem(el.id, el.defX, el.defY);
                if (st.enabled) {
                    el.render(ctx, mc.textRenderer, mc, st.x, st.y);
                }
            }
        });

        ClientTickEvents.END_CLIENT_TICK.register(this::onTick);
    }

    private void onTick(MinecraftClient mc) {
        // Open the editor.
        while (editorKey.wasPressed()) {
            mc.setScreen(new CabbageHudScreen());
        }

        if (mc.player == null) {
            return;
        }

        CabbageEsp.tick(mc);

        // CPS: count rising edges so we never steal vanilla's click events.
        boolean attack = mc.options.attackKey.isPressed();
        if (attack && !prevAttack) {
            CabbageElements.LEFT_CLICKS.add(System.currentTimeMillis());
        }
        prevAttack = attack;

        boolean use = mc.options.useKey.isPressed();
        if (use && !prevUse) {
            CabbageElements.RIGHT_CLICKS.add(System.currentTimeMillis());
        }
        prevUse = use;
    }
}
