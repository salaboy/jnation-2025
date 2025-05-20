/*
 * Copyright 2025 The Dapr Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
limitations under the License.
*/

package io.dapr.springboot.examples.orders;

import io.dapr.spring.workflows.config.EnableDaprWorkflows;
import io.dapr.springboot.examples.orders.workflow.OrderProcessingWorkflow;
import io.dapr.workflows.client.DaprWorkflowClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

@RestController
@EnableDaprWorkflows
public class OrdersRestController {

  private final Logger logger = LoggerFactory.getLogger(OrdersRestController.class);

  @Value("${PUBLIC_IP:localhost:8080}")
  private String publicIp;

  @Autowired
  private DaprWorkflowClient daprWorkflowClient;

  @Autowired
  private OrdersStore orderStore;

  private Map<String, String> ordersWorkflows = new HashMap<>();

  /**
   * Track customer endpoint.
   *
   * @param order provided customer to track
   * @return confirmation that the workflow instance was created for a given customer
   */
  @PostMapping("/orders")
  public Order placeOrder(@RequestBody Order order) {
    String instanceId = daprWorkflowClient.scheduleNewWorkflow(OrderProcessingWorkflow.class, order);
    logger.info("Workflow instance " + instanceId + " started");
    order.setWorkflowId(instanceId);
    ordersWorkflows.put(order.getId(), instanceId);
    //emitWSEvent(new Event(order));
    return order;
  }

  /**
   *  Request customer follow-up.
   *  @param order associated with a workflow instance
   *  @return confirmation that the follow-up was requested
   */
  @PostMapping("/order/approve")
  public String orderApproval(@RequestBody Order order) {
    logger.info("Order approval requested: " + order.getId());
    String workflowIdForCustomer = ordersWorkflows.get(order.getId());
    if (workflowIdForCustomer == null || workflowIdForCustomer.isEmpty()) {
      return "There is no workflow associated with customer: " + order.getId();
    } else {
      daprWorkflowClient.raiseEvent(workflowIdForCustomer, "OrderApprovalRequest", order);
      return "Order Approval requested";
    }
  }

  @GetMapping("/orders")
  public Collection<Order> getOrders() {
    return orderStore.getOrders();
  }

  public record Event(Order order) {
  }

  @GetMapping("/server-info")
  public Info getInfo(){
    return new Info(publicIp);
  }

  public record Info(String publicIp){}
}

