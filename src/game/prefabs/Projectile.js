import gameConfig from '../gameConfig';

export function fireProjectile(scene, x, y, target, hitAgainst, shooterType = 'player')
{
    // support both layouts:
    // - legacy: gameConfig.projectile.player / .enemy or gameConfig.projectile
    // - new: default export { player, enemy } where player.projectile / enemy.projectile exist
    let shooterCfg = null;
    if (gameConfig.projectile) {
        shooterCfg = gameConfig.projectile[shooterType] || gameConfig.projectile;
    } else if (gameConfig.player || gameConfig.enemy) {
        shooterCfg = (shooterType === 'enemy') ? (gameConfig.enemy && gameConfig.enemy.projectile) : (gameConfig.player && gameConfig.player.projectile);
    }
    const cfg = shooterCfg || { radius: 6, speed: 280, ttl: 3000, damage: 1 };
    const radius = cfg.radius || 6;
    const projectile = scene.add.circle(x, y, radius, 0xffdd00);
    scene.physics.add.existing(projectile);
    // if a projectiles group exists on the scene, add this projectile so we can manage collisions centrally
    try { if (scene.projectiles && typeof scene.projectiles.add === 'function') scene.projectiles.add(projectile); } catch (e) { /* ignore */ }
    projectile.body.setCircle(radius);
    projectile.body.setAllowGravity(false);

    // garantir visibilidade e depth para não ficar oculto atrás de outros objetos
    try {
        if (typeof projectile.setDepth === 'function') projectile.setDepth(1100);
        if (typeof projectile.setFillStyle === 'function') projectile.setFillStyle(0xffdd00, 1);
        if (typeof projectile.setVisible === 'function') projectile.setVisible(true);
        if (typeof projectile.setActive === 'function') projectile.setActive(true);
        if (typeof projectile.setStrokeStyle === 'function') projectile.setStrokeStyle(1, 0x000000, 1);
    } catch (e) {}

    // DEBUG: log criação do projétil
    try { console.debug('[Projectile] created', { x, y, radius, shooterType }); } catch (e) {}

    const speed = cfg.speed || 280;

    // deslocar ligeiramente o projétil para fora do ponto de origem em direção ao alvo
    try {
        const tx = (target && target.x !== undefined) ? target.x : x;
        const ty = (target && target.y !== undefined) ? target.y : y;
        let dx = tx - x;
        let dy = ty - y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const spawnOffset = Math.max(1, radius + 12);
        projectile.x = x + nx * spawnOffset;
        projectile.y = y + ny * spawnOffset;
        // atualizar corpo para nova posição
        if (projectile.body && typeof projectile.body.reset === 'function') {
            try { projectile.body.reset(projectile.x - radius, projectile.y - radius); } catch (e) { /* ignore */ }
        } else if (projectile.body) {
            projectile.body.x = projectile.x - radius;
            projectile.body.y = projectile.y - radius;
        }
        // record spawn position and minimum travel distance before allowing hits
        try { projectile._spawnX = projectile.x; projectile._spawnY = projectile.y; projectile._minTravel = Math.max(8, Math.floor(radius * 0.5)); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    scene.physics.moveToObject(projectile, target, speed);

    const ttl = cfg.ttl || 3000; // ms

    // mark as just spawned to avoid immediate overlap hits if spawned overlapping the target
    try {
        projectile._justSpawned = true;
        scene.time.addEvent({ delay: 40, callback: () => { try { projectile._justSpawned = false; } catch (e) {} } });
    } catch (e) { /* ignore */ }

    const destroyProjectile = () => {
        if (projectile && projectile.destroy)
        {
            projectile.destroy();
        }
    };

    // overlap handler: prefer calling object's `onHit` if present, otherwise apply generic health decrement
    const onHit = (proj, obj) => {
        // ignore hits that happen immediately after spawn (common when spawning near/inside targets)
        try { if (proj && proj._justSpawned) return; } catch (e) { /* ignore */ }
        // also require the projectile to have traveled a minimum distance from its spawn point
        try {
            const sx = (proj && typeof proj._spawnX !== 'undefined') ? proj._spawnX : proj.x;
            const sy = (proj && typeof proj._spawnY !== 'undefined') ? proj._spawnY : proj.y;
            const dx2 = (proj.x || 0) - sx;
            const dy2 = (proj.y || 0) - sy;
            const traveled = Math.hypot(dx2, dy2);
            const minTravel = (proj && proj._minTravel) ? proj._minTravel : 8;
            if (traveled < minTravel) return;
        } catch (e) { /* ignore */ }
        // adicional: verificar colisão real por distância entre centros usando raios
        try {
            const projRadius = (proj && proj.body && proj.body.width) ? Math.max(1, Math.round(proj.body.width * 0.5)) : (proj.radius || radius || 6);
            let targetRadius = 0;
            let targetCenterX = (obj && obj.x) ? obj.x : 0;
            let targetCenterY = (obj && obj.y) ? obj.y : 0;
            if (obj && obj.collisionRadius && typeof obj.collisionRadius === 'number') {
                targetRadius = obj.collisionRadius;
            } else if (obj && obj.body && typeof obj.body.width === 'number') {
                targetRadius = Math.max(1, Math.round(obj.body.width * 0.5));
            } else if (obj && obj.radius) {
                targetRadius = obj.radius;
            } else {
                targetRadius = 8;
            }
            // use physics body center if available (accounts for offsets)
            if (obj && obj.body && obj.body.center) {
                targetCenterX = obj.body.center.x;
                targetCenterY = obj.body.center.y;
            } else if (obj && obj.body && typeof obj.body.x === 'number' && typeof obj.body.width === 'number') {
                targetCenterX = obj.body.x + (obj.body.width * 0.5);
                targetCenterY = obj.body.y + (obj.body.height * 0.5 || 0);
            }
            const dx = (proj.x || 0) - targetCenterX;
            const dy = (proj.y || 0) - targetCenterY;
            const dist = Math.hypot(dx, dy);
            // only accept hit if projectile reached the visual/physical radii sum
            if (dist > (projRadius + targetRadius + 0.5)) {
                return;
            }
        } catch (e) { /* ignore distance fallback */ }
        try { console.debug('[Projectile] onHit', { proj, obj }); } catch (e) {}
        if (!obj || !obj.active) return;

        const dmg = (cfg && cfg.damage) || 1;
        if (typeof obj.onHit === 'function')
        {
            obj.onHit(proj, dmg);
        }
        else if (obj.health !== undefined)
        {
            obj.health = (obj.health || 1) - dmg;
            if (obj.health <= 0)
            {
                obj.destroy();
            }
        }
        else
        {
            if (scene.player && typeof scene.player.onHit === 'function')
            {
                scene.player.onHit(proj, dmg);
            }
        }

        destroyProjectile();
    };

    // decide what to check overlap against
    const overlapTarget = hitAgainst || scene.enemies;
    scene.physics.add.overlap(projectile, overlapTarget, onHit);

    // lifespan timer
    scene.time.addEvent({
        delay: ttl,
        callback: destroyProjectile
    });

    return projectile;
}
