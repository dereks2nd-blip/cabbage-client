package com.cabbage.hud.mixin;

import com.cabbage.hud.CabbageSkin;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Replaces the rotating title-screen panorama with Cabbage's flat pixel-art
 * scene (cabbages + tennis birds). Injecting into renderPanoramaBackground —
 * which TitleScreen.render calls after its fade math — keeps the vanilla
 * logo/splash/button fade fully intact; only the backdrop changes. Other
 * screens that render a panorama (e.g. options from the menu) get it too,
 * which matches how Lunar/Feather theme the whole menu stack.
 */
@Mixin(Screen.class)
public abstract class ScreenPanoramaMixin {

    @Unique
    private static final Identifier CABBAGE_TITLE_BG =
            Identifier.of("cabbage-hud", "textures/gui/title_background.png");

    @Unique
    private static final int CABBAGE_TEX_W = 960;

    @Unique
    private static final int CABBAGE_TEX_H = 540;

    @Inject(method = "renderPanoramaBackground", at = @At("HEAD"), cancellable = true)
    private void cabbage$titleBackground(DrawContext ctx, float delta, CallbackInfo ci) {
        Screen self = (Screen) (Object) this;
        int sw = self.width;
        int sh = self.height;
        if (sw <= 0 || sh <= 0) {
            return;
        }
        // cover-fit: scale the art to fill the screen and center the overflow,
        // so any aspect ratio still gets a full backdrop with no stretching
        float scale = Math.max(sw / (float) CABBAGE_TEX_W, sh / (float) CABBAGE_TEX_H);
        int dw = (int) Math.ceil(CABBAGE_TEX_W * scale);
        int dh = (int) Math.ceil(CABBAGE_TEX_H * scale);
        ctx.drawTexture(RenderLayer::getGuiTextured, CABBAGE_TITLE_BG,
                (sw - dw) / 2, (sh - dh) / 2, 0f, 0f, dw, dh,
                CABBAGE_TEX_W, CABBAGE_TEX_H, CABBAGE_TEX_W, CABBAGE_TEX_H);

        // branding badge, top-left (drawn under the logo/widgets)
        if (self instanceof TitleScreen) {
            CabbageSkin.drawBird(ctx, 5, 5, 16);
            ctx.drawTextWithShadow(net.minecraft.client.MinecraftClient.getInstance().textRenderer,
                    "CABBAGE CLIENT", 25, 9, CabbageSkin.LIME);
        }
        ci.cancel();
    }
}
