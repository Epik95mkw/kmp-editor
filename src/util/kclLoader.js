const { BinaryParser } = require("./binaryParser.js")
const { ModelBuilder } = require("./modelBuilder.js")
const { Vec3 } = require("../math/vec3.js")


class Kcl
{
	constructor(bytes)
	{
		let parser = new BinaryParser(bytes)
		this.triangles = []
		
		let section1Offset = parser.readUInt32()
		let section2Offset = parser.readUInt32()
		let section3Offset = parser.readUInt32()
		let section4Offset = parser.readUInt32()
		
		let vertices = []
		parser.seek(section1Offset)
		while (parser.head < section2Offset)
		{
			let x = parser.readFloat32()
			let y = parser.readFloat32()
			let z = parser.readFloat32()
			vertices.push(new Vec3(x, -z, -y))
		}
		
		let normals = []
		parser.seek(section2Offset)
		while (parser.head < section3Offset + 0x10)
		{
			let x = parser.readFloat32()
			let y = parser.readFloat32()
			let z = parser.readFloat32()
			normals.push(new Vec3(x, -z, -y))
		}
		
		parser.seek(section3Offset + 0x10)
		while (parser.head < section4Offset)
		{
			let len = parser.readFloat32()
			let posIndex = parser.readUInt16()
			let dirIndex = parser.readUInt16()
			let normAIndex = parser.readUInt16()
			let normBIndex = parser.readUInt16()
			let normCIndex = parser.readUInt16()
			let collisionFlags = parser.readUInt16()
			
			if (posIndex >= vertices.length ||
				dirIndex >= normals.length ||
				normAIndex >= normals.length ||
				normBIndex >= normals.length ||
				normCIndex >= normals.length)
				continue
			
			let vertex = vertices[posIndex]
			let direction = normals[dirIndex]
			let normalA = normals[normAIndex]
			let normalB = normals[normBIndex]
			let normalC = normals[normCIndex]
			
			let crossA = normalA.cross(direction)
			let crossB = normalB.cross(direction)
			let v1 = vertex
			let v2 = vertex.add(crossB.scale(len / crossB.dot(normalC)))
			let v3 = vertex.add(crossA.scale(len / crossA.dot(normalC)))
			
			if (!v1.isFinite() || !v2.isFinite() || !v3.isFinite())
				continue
			
			if (collisionFlags & 0x1f >= 32)
				continue

			this.triangles.push({
				v1: v1,
				v2: v2,
				v3: v3,
				normal: v2.sub(v1).cross(v3.sub(v1)).normalize(),
				flags: collisionFlags,
				color: [1, 1, 1, 1],
				render: false,
				forced: false
			})
		}
	}


	setProperties(cfg)
	{
		let collisionTypeData =
		[
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 1.0, 1.0, 1.0] }, // Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 0.9, 0.8, 1.0] }, // Slippery Road (sand/dirt)
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.0, 0.8, 0.0, 1.0] }, // Weak Off-Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.0, 0.6, 0.0, 1.0] }, // Off-Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.0, 0.4, 0.0, 1.0] }, // Heavy Off-Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.8, 0.9, 1.0, 1.0] }, // Slippery Road (ice)
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 0.5, 0.0, 1.0] }, // Boost Panel
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 0.6, 0.0, 1.0] }, // Boost Ramp
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 0.8, 0.0, 1.0] }, // Slow Ramp
			{ isDeath: false, isInvis: true,  isEffect: false, isWall: false, c: [0.9, 0.9, 1.0, 0.5] }, // Item Road
			{ isDeath: true,  isInvis: false, isEffect: false, isWall: false, c: [0.7, 0.1, 0.1, 1.0] }, // Solid Fall
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.0, 0.5, 1.0, 1.0] }, // Moving Water
			{ isDeath: false, isInvis: false, isEffect: false, isWall: true,  c: [0.6, 0.6, 0.6, 1.0] }, // Wall
			{ isDeath: false, isInvis: true,  isEffect: false, isWall: true,  c: [0.0, 0.0, 0.6, 0.8] }, // Invisible Wall
			{ isDeath: false, isInvis: true,  isEffect: false, isWall: false, c: [0.6, 0.6, 0.7, 0.5] }, // Item Wall
			{ isDeath: false, isInvis: false, isEffect: false, isWall: true,  c: [0.6, 0.6, 0.6, 1.0] }, // Wall
			{ isDeath: true,  isInvis: false, isEffect: false, isWall: false, c: [0.8, 0.0, 0.0, 0.8] }, // Fall Boundary
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: false, c: [1.0, 0.0, 0.5, 0.8] }, // Cannon Activator
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: false, c: [0.5, 0.0, 1.0, 0.5] }, // Force Recalculation
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.0, 0.3, 1.0, 1.0] }, // Half-pipe Ramp
			{ isDeath: false, isInvis: false, isEffect: false, isWall: true,  c: [0.6, 0.6, 0.6, 1.0] }, // Wall (items pass through)
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.9, 0.9, 1.0, 1.0] }, // Moving Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.9, 0.7, 1.0, 1.0] }, // Sticky Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [1.0, 1.0, 1.0, 1.0] }, // Road (alt sfx)
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: false, c: [1.0, 0.0, 1.0, 0.8] }, // Sound Trigger
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: true,  c: [0.4, 0.6, 0.4, 0.8] }, // Weak Wall
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: false, c: [0.8, 0.0, 1.0, 0.8] }, // Effect Trigger
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: false, c: [1.0, 0.0, 1.0, 0.5] }, // Item State Modifier
			{ isDeath: false, isInvis: false, isEffect: true,  isWall: true,  c: [0.0, 0.6, 0.0, 0.8] }, // Half-pipe Invis Wall
			{ isDeath: false, isInvis: false, isEffect: false, isWall: false, c: [0.9, 0.9, 1.0, 1.0] }, // Rotating Road
			{ isDeath: false, isInvis: false, isEffect: false, isWall: true,  c: [0.8, 0.7, 0.8, 1.0] }, // Special Wall
			{ isDeath: false, isInvis: false, isEffect: false, isWall: true,  c: [0.6, 0.6, 0.6, 1.0] }, // Wall
		]

		for (let tri of this.triangles)
		{
			if (tri.forced)
			{
				tri.render = true
				tri.forced = false
				continue
			}

			tri.render = false
			let data = collisionTypeData[tri.flags & 0x1f]

			if (cfg && data.isWall && cfg.kclEnableWalls !== undefined && !cfg.kclEnableWalls)
				continue

			if (cfg && data.isDeath && cfg.kclEnableDeathBarriers !== undefined && !cfg.kclEnableDeathBarriers)
				continue
			
			if (cfg && data.isInvis && cfg.kclEnableInvisible !== undefined && !cfg.kclEnableInvisible)
				continue
			
			if (cfg && data.isEffect && cfg.kclEnableEffects !== undefined && !cfg.kclEnableEffects)
				continue
			

			if (cfg && cfg.kclEnableColors !== undefined && !cfg.kclEnableColors)
				tri.color = [1, 1, 1, 1]
			else
				tri.color = data.c


			if (cfg && cfg.kclHighlighter !== undefined)
			{
				let highlighted = false
				switch (cfg.kclHighlighter)
				{
					case 1:
						highlighted = tri.flags & 0x2000
						break

					case 2:
						highlighted = data.isWall && tri.normal.dot(new Vec3(0, 0, 1)) > 0.9
						break

					case 3:
						highlighted = data.isWall && tri.flags & 0x8000
						break
				}

				if (highlighted)
					tri.color = [1.0, 1.0, 0.0, 1.0]
			}
			
			tri.render = true
		}

		return this
	}


	refreshModel()
	{
		let model = new ModelBuilder()

		for (let tri of this.triangles)
			if (tri.render)
				model.addTri(tri.v1, tri.v2, tri.v3, tri.color, tri.color, tri.color)
		
		return model.calculateNormals()
	}

	getCannonTriggers1()
	{
		let triggers = []
		for (let i = 0; i < 8; i++)
		{
			let indexTriggers = []
			for (let tri of this.triangles)
			{
				if (tri.flags & 0x1f == 17)
					indexTriggers.push(tri)
			}
			triggers.push(indexTriggers)
		}

		return triggers
	}

	getCannonTriggers()
	{
		let triggers = []
		for (let tri of this.triangles)
		{
			//if (tri.flags & 0x1f == 0)
				triggers.push(tri)
		}
		return triggers
	}
}


if (module)
	module.exports = { Kcl }