namespace EDUMETRICS_DR.Filters;

[AttributeUsage(AttributeTargets.Method)]
public class AuditActionAttribute : Attribute
{
    public AuditActionAttribute(string actionName)
    {
        ActionName = actionName;
    }

    public string ActionName { get; }
}
