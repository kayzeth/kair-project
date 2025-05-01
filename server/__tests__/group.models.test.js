const mongoose = require('mongoose');
const Group = require('../models/Group');

// Use in-memory MongoDB server for testing
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Group Model', () => {
  let mongoServer;

  // Set up MongoDB Memory Server before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // Clear the database between tests
  afterEach(async () => {
    await Group.deleteMany({});
  });

  test('should create a group with all required fields', async () => {
    // Arrange
    const groupData = {
      name: 'Test Group'
    };

    // Act
    const group = new Group(groupData);
    const savedGroup = await group.save();

    // Assert
    expect(savedGroup._id).toBeDefined();
    expect(savedGroup.name).toBe(groupData.name);
    expect(savedGroup.recurrence_rule).toBeNull();
    expect(savedGroup.createdAt).toBeDefined();
    expect(savedGroup.updatedAt).toBeDefined();
  });

  test('should create a group with recurrence rule', async () => {
    // Arrange
    const groupData = {
      name: 'Recurring Group',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    };

    // Act
    const group = new Group(groupData);
    const savedGroup = await group.save();

    // Assert
    expect(savedGroup._id).toBeDefined();
    expect(savedGroup.name).toBe(groupData.name);
    expect(savedGroup.recurrence_rule).toBe(groupData.recurrence_rule);
  });

  test('should not create a group without required name field', async () => {
    // Arrange
    const groupData = {
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    };

    // Act & Assert
    await expect(async () => {
      const group = new Group(groupData);
      await group.save();
    }).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test('should update an existing group', async () => {
    // Arrange
    const groupData = {
      name: 'Original Group Name'
    };
    const group = new Group(groupData);
    const savedGroup = await group.save();
    
    // Store the original updatedAt timestamp
    const originalUpdatedAt = savedGroup.updatedAt;
    
    // Add a small delay to ensure the timestamps will be different
    await new Promise(resolve => setTimeout(resolve, 10));

    // Act
    savedGroup.name = 'Updated Group Name';
    savedGroup.recurrence_rule = 'FREQ=DAILY';
    const updatedGroup = await savedGroup.save();

    // Assert
    expect(updatedGroup._id).toEqual(savedGroup._id);
    expect(updatedGroup.name).toBe('Updated Group Name');
    expect(updatedGroup.recurrence_rule).toBe('FREQ=DAILY');
    
    // Verify the document was updated by checking if the updatedAt field changed
    // or by retrieving it again from the database
    const refetchedGroup = await Group.findById(updatedGroup._id);
    expect(refetchedGroup.name).toBe('Updated Group Name');
    expect(refetchedGroup.recurrence_rule).toBe('FREQ=DAILY');
  });

  test('should find a group by name', async () => {
    // Arrange
    const groupData = {
      name: 'Searchable Group'
    };
    await new Group(groupData).save();

    // Act
    const foundGroup = await Group.findOne({ name: 'Searchable Group' });

    // Assert
    expect(foundGroup).toBeDefined();
    expect(foundGroup.name).toBe('Searchable Group');
  });

  test('should delete a group', async () => {
    // Arrange
    const groupData = {
      name: 'Group to Delete'
    };
    const group = await new Group(groupData).save();

    // Act
    await Group.deleteOne({ _id: group._id });
    const deletedGroup = await Group.findById(group._id);

    // Assert
    expect(deletedGroup).toBeNull();
  });

  test('should handle multiple groups', async () => {
    // Arrange
    const groupsData = [
      { name: 'Group 1' },
      { name: 'Group 2', recurrence_rule: 'FREQ=WEEKLY' },
      { name: 'Group 3', recurrence_rule: 'FREQ=MONTHLY' }
    ];

    // Act
    await Group.insertMany(groupsData);
    const groups = await Group.find().sort({ name: 1 });

    // Assert
    expect(groups.length).toBe(3);
    expect(groups[0].name).toBe('Group 1');
    expect(groups[1].name).toBe('Group 2');
    expect(groups[2].name).toBe('Group 3');
    expect(groups[0].recurrence_rule).toBeNull();
    expect(groups[1].recurrence_rule).toBe('FREQ=WEEKLY');
    expect(groups[2].recurrence_rule).toBe('FREQ=MONTHLY');
  });
});
