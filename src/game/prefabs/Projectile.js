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
    projectile.body.setCircle(radius);
    projectile.body.setAllowGravity(false);

    const speed = cfg.speed || 280;
    scene.physics.moveToObject(projectile, target, speed);

    const ttl = cfg.ttl || 3000; // ms

    const destroyProjectile = () => {
        if (projectile && projectile.destroy)
        {
            projectile.destroy();
        }
    };

    // overlap handler: prefer calling object's `onHit` if present, otherwise apply generic health decrement
    const onHit = (proj, obj) => {
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
