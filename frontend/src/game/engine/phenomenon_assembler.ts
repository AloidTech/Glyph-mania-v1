import { secondsToTicks } from './tick_engine';
import { BasePhenomenon, StationaryZonePhenomenon, ProjectilePhenomenon } from './phenomenon';
import { 
  EffectorData, 
  FormSigilData, 
  PositionSigilData, 
  IPhenomenonBlueprint, 
  MovementState 
} from '../../types/phenomenon_types';

export class PhenomenonAssembler {
  /**
   * Assembles a Phenomenon based on provided sigils and spawn parameters.
   */
  public static assemble(
    effector: EffectorData,
    form: FormSigilData,
    position: PositionSigilData,
    spawnOrigin: { x: number; y: number; z: number },
    targetAimVector?: { x: number; y: number; z: number }
  ): BasePhenomenon {
    
    let movement: MovementState;
    if (position.behaviorType === 'STATIONARY') {
      movement = {
        type: 'STATIONARY',
        anchorPoint: { ...spawnOrigin }
      };
    } else {
      movement = {
        type: 'LINEAR_PROJECTILE',
        speed: position.projectileSpeed || 10,
        directionVector: targetAimVector || { x: 1, y: 0, z: 0 }
      };
    }

    const hitDamage = effector.baseHitDamage * (form.hitDamageMultiplier ?? 1.0);
    
    const scaledStatusPayloads = effector.statusPayloads.map(payload => ({
      effectType: payload.effectType,
      tickDamage: payload.tickDamage * (form.tickDamageMultiplier ?? 1.0),
      intervalTicks: Math.max(1, Math.round(payload.intervalTicks * (form.intervalMultiplier ?? 1.0))),
      durationTicks: Math.max(1, Math.round(payload.durationTicks * (form.durationMultiplier ?? 1.0))),
      magnitude: payload.magnitude
    }));

    const lifetimeSeconds = form.baseLifetimeSeconds ?? 5.0;
    const lifetimeTicks = secondsToTicks(lifetimeSeconds);

    const blueprint: IPhenomenonBlueprint = {
      name: `${effector.label} ${form.label} ${position.label}`,
      movement,
      shape: {
        shapeType: form.shapeType,
        radius: form.radiusMeters,
        penetrationCount: form.penetrationCount
      },
      baseHitDamage: hitDamage,
      statusPayloads: scaledStatusPayloads,
      visual: effector.elementVisualData,
      lifetimeTicks: lifetimeTicks
    };

    if (position.behaviorType === 'STATIONARY') {
      return new StationaryZonePhenomenon(blueprint, spawnOrigin);
    } else {
      return new ProjectilePhenomenon(blueprint, spawnOrigin);
    }
  }
}
