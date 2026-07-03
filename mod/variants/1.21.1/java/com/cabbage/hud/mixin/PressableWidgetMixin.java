package com.cabbage.hud.mixin;

import com.cabbage.hud.CabbageBlockEspScreen;
import com.cabbage.hud.CabbageHudScreen;
import com.cabbage.hud.CabbageSkin;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.client.gui.widget.PressableWidget;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Skins buttons on Cabbage-owned screens (title screen + HUD editor) with the
 * CabbageSkin look. renderWidget is final on PressableWidget, so this one hook
 * covers ButtonWidget and friends. Small icon buttons (language/accessibility,
 * width < 40) keep the vanilla look so their icons don't disappear; every other
 * screen in the game is untouched.
 */
@Mixin(PressableWidget.class)
public abstract class PressableWidgetMixin {

    @Inject(method = "renderWidget", at = @At("HEAD"), cancellable = true)
    private void cabbage$skin(DrawContext ctx, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        Screen screen = mc.currentScreen;
        if (!(screen instanceof TitleScreen) && !(screen instanceof CabbageHudScreen)
                && !(screen instanceof CabbageBlockEspScreen)) {
            return;
        }
        PressableWidget self = (PressableWidget) (Object) this;
        if (self.getWidth() < 40) {
            return;
        }
        CabbageSkin.drawButton(ctx, mc.textRenderer, self);
        ci.cancel();
    }
}
